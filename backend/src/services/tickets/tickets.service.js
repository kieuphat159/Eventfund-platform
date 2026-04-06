import mongoose from 'mongoose';
import { ethers } from 'ethers';
import * as ticketRepo from '../../repositories/ticket.repo.js';
import * as eventRepo from '../../repositories/event.repo.js';
import { NotFoundError, BadRequestError } from '../../utils/customErrors.js';
import { getTicket, provider } from '../blockchain/index.js';

const ONCHAIN_TICKET_STATUS = {
  MINTED: 0n,
  SOLD: 1n
};

function normalizeTxHash(txHash) {
  return txHash?.toLowerCase();
}

function toTokenIdString(value) {
  if (value === undefined || value === null) return '';
  return typeof value === 'bigint' ? value.toString() : String(value);
}

function validateTransactionHash(txHash) {
  if (!txHash || !ethers.isHexString(txHash, 32)) {
    throw new BadRequestError('Invalid transaction hash');
  }
}

async function parseTicketEventsFromReceipt(receipt) {
  const contract = getTicket();
  const ticketAddress = (await contract.getAddress()).toLowerCase();
  const parsedEvents = [];

  for (const log of receipt.logs || []) {
    if (!log?.address || log.address.toLowerCase() !== ticketAddress) {
      continue;
    }

    try {
      const parsed = contract.interface.parseLog(log);
      parsedEvents.push(parsed);
    } catch {
      // Ignore non-ticket logs or decode failures.
    }
  }

  return parsedEvents;
}

function ensureEventOpenForTicketing(event) {
  if (!['ticketing', 'ongoing'].includes(event.status)) {
    throw new BadRequestError('Event is not open for ticket purchase');
  }
}

async function findMintedTicketByEventId(eventId, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;

  const result = await ticketRepository.findTickets(
    { eventId, status: 'minted', isListed: false },
    { page: 1, limit: 1, sort: 'createdAt', lean: true }
  );

  return result?.docs?.[0] || null;
}

/**
 * Build a primary-sale purchase intent for wallet signing
 * @param {Object} payload - Purchase request payload
 * @param {string} buyerWallet - Buyer wallet address
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object>} Encoded on-chain transaction payload
 */
export async function createPurchaseIntent(payload = {}, buyerWallet, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;
  const eventRepository = repos.eventRepo || eventRepo;

  const { eventId, tokenId } = payload;
  if (!eventId && !tokenId) {
    throw new BadRequestError('Either eventId or tokenId is required');
  }

  if (!buyerWallet) {
    throw new BadRequestError('Buyer wallet address is required');
  }

  let selectedTicket = null;

  if (tokenId) {
    selectedTicket = await ticketRepository.findByTokenId(String(tokenId), { lean: true });
  } else {
    if (!mongoose.isValidObjectId(eventId)) {
      throw new BadRequestError('Invalid event id');
    }
    selectedTicket = await findMintedTicketByEventId(eventId, repos);
  }

  if (!selectedTicket) {
    throw new NotFoundError('No available minted ticket found');
  }

  if (eventId && String(selectedTicket.eventId) !== String(eventId)) {
    throw new BadRequestError('Ticket does not belong to this event');
  }

  const event = await eventRepository.findById(selectedTicket.eventId);
  if (!event) {
    throw new NotFoundError('Event not found');
  }
  ensureEventOpenForTicketing(event);

  const ticketContract = getTicket();
  const chainTokenId = BigInt(selectedTicket.tokenId);

  const [chainStatus, chainPrice, contractAddress, network] = await Promise.all([
    ticketContract.getTicketStatus(chainTokenId),
    ticketContract.getTicketPrice(chainTokenId),
    ticketContract.getAddress(),
    provider.getNetwork()
  ]);

  if (chainStatus !== ONCHAIN_TICKET_STATUS.MINTED) {
    throw new BadRequestError('Ticket is no longer available for primary purchase');
  }

  const data = ticketContract.interface.encodeFunctionData('purchaseTicket', [chainTokenId]);

  return {
    tokenId: selectedTicket.tokenId,
    eventId: String(selectedTicket.eventId),
    buyer: buyerWallet.toLowerCase(),
    transaction: {
      to: contractAddress,
      data,
      value: chainPrice.toString(),
      chainId: network.chainId.toString(),
      functionName: 'purchaseTicket'
    }
  };
}

/**
 * Confirm a primary-sale purchase transaction and sync DB
 * @param {Object} payload - Confirmation payload
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object>} Synced ticket information
 */
export async function confirmPurchaseTransaction(payload = {}, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;
  const eventRepository = repos.eventRepo || eventRepo;

  const { txHash, tokenId, buyerWallet } = payload;

  validateTransactionHash(txHash);

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    throw new BadRequestError('Transaction not mined yet');
  }
  if (Number(receipt.status) !== 1) {
    throw new BadRequestError('Transaction failed on-chain');
  }

  const parsedEvents = await parseTicketEventsFromReceipt(receipt);
  const purchaseEvents = parsedEvents.filter((event) => event?.name === 'TicketPurchased');

  let matchedEvent = null;

  if (tokenId) {
    matchedEvent = purchaseEvents.find((event) => {
      const eventTokenId = toTokenIdString(event.args?.tokenId);
      return eventTokenId === String(tokenId);
    });
  } else {
    [matchedEvent] = purchaseEvents;
  }

  if (!matchedEvent) {
    throw new BadRequestError('TicketPurchased event not found in transaction receipt');
  }

  const purchasedTokenId = toTokenIdString(matchedEvent.args?.tokenId);
  const buyerFromChain = String(matchedEvent.args?.buyer || '').toLowerCase();
  const priceFromChain = matchedEvent.args?.price?.toString?.() || undefined;

  if (buyerWallet && buyerFromChain !== buyerWallet.toLowerCase()) {
    throw new BadRequestError('Buyer wallet does not match on-chain event');
  }

  const existingTicket = await ticketRepository.findByTokenId(purchasedTokenId, { lean: true });
  if (!existingTicket) {
    throw new NotFoundError('Ticket not found in database');
  }

  if (existingTicket.status === 'sold' && existingTicket.currentOwner?.toLowerCase() === buyerFromChain) {
    return {
      synced: false,
      alreadySynced: true,
      txHash: normalizeTxHash(txHash),
      ticket: existingTicket
    };
  }

  const block = receipt.blockNumber ? await provider.getBlock(receipt.blockNumber) : null;
  const soldAt = block ? new Date(Number(block.timestamp) * 1000) : new Date();

  const updatedTicket = await ticketRepository.markAsSold(
    purchasedTokenId,
    {
      buyer: buyerFromChain,
      from: existingTicket.currentOwner,
      soldAt,
      soldTxHash: normalizeTxHash(txHash),
      price: priceFromChain
    }
  );

  await eventRepository.incrementTicketCounters(existingTicket.eventId, {
    ticketsSold: 1
  });

  return {
    synced: true,
    alreadySynced: false,
    txHash: normalizeTxHash(txHash),
    ticket: updatedTicket
  };
}

/**
 * Build ticket use intent for verifier wallet signing
 * @param {string} tokenId - Ticket token ID
 * @param {string} verifierWallet - Verifier wallet address
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object>} Encoded on-chain transaction payload
 */
export async function createUseTicketIntent(tokenId, verifierWallet, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;
  const eventRepository = repos.eventRepo || eventRepo;

  const ticket = await ticketRepository.findByTokenId(tokenId, { lean: true });
  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }
  if (ticket.status !== 'sold') {
    throw new BadRequestError('Ticket must be sold before check-in');
  }

  const event = await eventRepository.findById(ticket.eventId);
  if (!event) {
    throw new NotFoundError('Event not found');
  }
  if (event.status !== 'ongoing') {
    throw new BadRequestError('Event must be ongoing for check-in');
  }

  const now = new Date();
  if (now < event.startDate || now > event.endDate) {
    throw new BadRequestError('Current time must be within event dates');
  }

  const ticketContract = getTicket();
  const chainTokenId = BigInt(token.tokenId);

  const [chainStatus, contractAddress, network] = await Promise.all([
    ticketContract.getTicketStatus(chainTokenId),
    ticketContract.getAddress(),
    provider.getNetwork()
  ]);

  if (chainStatus !== ONCHAIN_TICKET_STATUS.SOLD) {
    throw new BadRequestError('Ticket is not in sold state on-chain');
  }

  const data = ticketContract.interface.encodeFunctionData('markAsUsed', [chainTokenId]);

  return {
    tokenId: token.tokenId,
    verifier: verifierWallet.toLowerCase(),
    transaction: {
      to: contractAddress,
      data,
      value: '0',
      chainId: network.chainId.toString(),
      functionName: 'markAsUsed'
    }
  };
}

/**
 * Confirm a ticket check-in transaction and sync DB
 * @param {Object} payload - Confirmation payload
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object>} Synced ticket information
 */
export async function confirmUseTicketTransaction(payload = {}, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;
  const eventRepository = repos.eventRepo || eventRepo;

  const { txHash, tokenId, verifierWallet } = payload;

  validateTransactionHash(txHash);

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    throw new BadRequestError('Transaction not mined yet');
  }
  if (Number(receipt.status) !== 1) {
    throw new BadRequestError('Transaction failed on-chain');
  }

  const parsedEvents = await parseTicketEventsFromReceipt(receipt);
  const usedEvents = parsedEvents.filter((event) => event?.name === 'TicketUsed');

  let matchedEvent = null;

  if (tokenId) {
    matchedEvent = usedEvents.find((event) => {
      const eventTokenId = toTokenIdString(event.args?.tokenId);
      return eventTokenId === String(tokenId);
    });
  } else {
    [matchedEvent] = usedEvents;
  }

  if (!matchedEvent) {
    throw new BadRequestError('TicketUsed event not found in transaction receipt');
  }

  const usedTokenId = toTokenIdString(matchedEvent.args?.tokenId);
  const verifierFromChain = String(matchedEvent.args?.verifiedBy || '').toLowerCase();

  if (verifierWallet && verifierFromChain !== verifierWallet.toLowerCase()) {
    throw new BadRequestError('Verifier wallet does not match on-chain event');
  }

  const existingTicket = await ticketRepository.findByTokenId(usedTokenId, { lean: true });
  if (!existingTicket) {
    throw new NotFoundError('Ticket not found in database');
  }

  if (existingTicket.status === 'used') {
    return {
      synced: false,
      alreadySynced: true,
      txHash: normalizeTxHash(txHash),
      ticket: existingTicket
    };
  }

  const usedAtArg = matchedEvent.args?.usedAt ?? matchedEvent.args?.timestamp;
  let resolvedUsedAt = null;

  if (usedAtArg) {
    resolvedUsedAt = new Date(Number(usedAtArg) * 1000);
  } else if (receipt.blockNumber) {
    const block = await provider.getBlock(receipt.blockNumber);
    resolvedUsedAt = new Date(Number(block.timestamp) * 1000);
  } else {
    resolvedUsedAt = new Date();
  }

  const updatedTicket = await ticketRepository.markAsUsedFromChain(
    usedTokenId,
    {
      usedAt: resolvedUsedAt,
      verifiedBy: verifierFromChain,
      usedTxHash: normalizeTxHash(txHash)
    }
  );

  await eventRepository.incrementTicketCounters(existingTicket.eventId, {
    totalTicketsUsed: 1
  });

  return {
    synced: true,
    alreadySynced: false,
    txHash: normalizeTxHash(txHash),
    ticket: updatedTicket
  };
}

/**
 * Get tickets with filters and pagination
 * @param {Object} query - Query parameters from request
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object>} Paginated tickets
 */
export async function getTickets(query = {}, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;

  const { eventId, status, owner, page, limit, sort } = query;

  const dbQuery = {
    ...(eventId && { eventId }),
    ...(status && { status }),
    ...(owner && { currentOwner: owner.toLowerCase() })
  };

  const options = {
    page: page ? parseInt(page, 10) : 1,
    limit: Math.min(limit ? parseInt(limit, 10) : 20, 100),
    sort: sort || '-createdAt',
    lean: true
  };

  return await ticketRepository.findTickets(dbQuery, options);
}

/**
 * Get ticket by token ID with transfer history
 * @param {string} tokenId - Token ID
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object|null>} Ticket or null
 */
export async function getTicketById(tokenId, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;

  const ticket = await ticketRepository.findByTokenId(tokenId, { lean: false });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  return ticket;
}

/**
 * Get all tickets for a wallet address
 * @param {string} walletAddress - Wallet address
 * @param {Object} query - Query parameters from request
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object>} Paginated tickets
 */
export async function getUserTickets(walletAddress, query = {}, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;

  const { page, limit, sort } = query;

  const options = {
    page: page ? parseInt(page, 10) : 1,
    limit: Math.min(limit ? parseInt(limit, 10) : 20, 100),
    sort: sort || '-createdAt',
    lean: true,
    populate: 'eventId'
  };

  return await ticketRepository.findByOwner(walletAddress, options);
}

/**
 * Verify ticket ownership
 * @param {string} tokenId - Token ID
 * @param {string} walletAddress - Wallet address to verify
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<boolean>} True if owner matches
 */
export async function verifyTicketOwnership(tokenId, walletAddress, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;

  const ticket = await ticketRepository.findByTokenId(tokenId);

  if (!ticket) {
    return false;
  }

  return ticket.currentOwner.toLowerCase() === walletAddress.toLowerCase();
}

/**
 * Mark ticket as used during event check-in
 * @param {string} tokenId - Token ID
 * @param {string} verifierWallet - Verifier wallet address
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object>} Updated ticket
 */
export async function markTicketAsUsed(tokenId, verifierWallet, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;
  const eventRepository = repos.eventRepo || eventRepo;

  const ticket = await ticketRepository.findByTokenId(tokenId, { lean: false });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  // Check if already used (idempotent)
  if (ticket.status === 'used') {
    return ticket;
  }

  // Validate ticket status
  if (ticket.status !== 'sold') {
    throw new BadRequestError('Ticket must be in sold status to be marked as used');
  }

  // Get event and validate
  const event = await eventRepository.findById(ticket.eventId);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Validate event status
  if (event.status !== 'ongoing') {
    throw new BadRequestError('Event must be in ongoing status');
  }

  // Validate current time is within event dates
  const now = new Date();
  if (now < event.startDate || now > event.endDate) {
    throw new BadRequestError('Current time must be within event dates');
  }

  // Update ticket using repository
  const usageData = {
    usedAt: now,
    verifiedBy: verifierWallet.toLowerCase()
  };

  const updatedTicket = await ticketRepository.markAsUsed(tokenId, usageData);

  // Update event counter using repository
  await eventRepository.incrementTicketCounters(ticket.eventId, {
    totalTicketsUsed: 1
  });

  return updatedTicket;
}

/**
 * Get ticket statistics for an event
 * @param {string} eventId - Event ID
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object>} Ticket stats
 */
export async function getTicketStats(eventId, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;

  // Convert eventId to ObjectId for aggregation
  const eventObjectId = new mongoose.Types.ObjectId(eventId);

  const stats = await ticketRepository.getTicketStatsByEvent(eventObjectId);

  // Transform repository stats to match expected format
  return {
    totalTickets: stats.total || 0,
    soldTickets: stats.sold || 0,
    usedTickets: stats.used || 0,
    mintedTickets: stats.minted || 0,
    availableTickets: stats.minted || 0
  };
}

/**
 * Verify ticket ownership and return ticket details
 * @param {string} tokenId - Token ID
 * @param {string} walletAddress - Wallet address to verify
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object>} Verification result with ticket details
 */
export async function verifyTicket(tokenId, walletAddress, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;

  const ticket = await ticketRepository.findByTokenId(tokenId, { lean: false });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  const isOwner = ticket.currentOwner.toLowerCase() === walletAddress.toLowerCase();

  return {
    isOwner,
    ticket
  };
}
