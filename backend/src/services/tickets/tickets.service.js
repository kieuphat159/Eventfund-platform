import mongoose from 'mongoose';
import { ethers } from 'ethers';
import * as ticketRepo from '../../repositories/ticket.repo.js';
import * as eventRepo from '../../repositories/event.repo.js';
import * as listingRepo from '../../repositories/listing.repo.js';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from '../../utils/customErrors.js';
import { getFund, getTicket, provider } from '../blockchain/index.js';

const ONCHAIN_TICKET_STATUS = {
  MINTED: 0n,
  SOLD: 1n,
  USED: 2n,
  EXPIRED: 3n,
  REFUNDED: 4n,
};

function mapChainTicketTypeToDb(ticketTypeValue) {
  const value = Number(ticketTypeValue);
  if (value === 1) return 'vip';
  if (value === 2) return 'early_bird';
  if (value === 3) return 'etc';
  return 'standard';
}

function mapOnchainStatusToDbStatus(chainStatus) {
  if (chainStatus === ONCHAIN_TICKET_STATUS.SOLD) return 'sold';
  if (chainStatus === ONCHAIN_TICKET_STATUS.USED) return 'used';
  if (chainStatus === ONCHAIN_TICKET_STATUS.EXPIRED) return 'expired';
  if (chainStatus === ONCHAIN_TICKET_STATUS.REFUNDED) return 'refunded';
  return null;
}

function normalizeTxHash(txHash) {
  return txHash?.toLowerCase();
}

function toTokenIdString(value) {
  if (value === undefined || value === null) return '';
  return typeof value === 'bigint' ? value.toString() : String(value);
}

function normalizeWalletAddress(value) {
  return value ? String(value).toLowerCase() : '';
}

async function getOnChainTicketSnapshot(tokenId, event = null) {
  const ticketContract = getTicket();
  const chainTokenId = BigInt(tokenId);

  const [owner, chainStatus, chainEventId] = await Promise.all([
    ticketContract.ownerOf(chainTokenId),
    ticketContract.getTicketStatus(chainTokenId),
    ticketContract.getEventId(chainTokenId),
  ]);

  if (
    event?.contractEventId &&
    String(chainEventId) !== String(event.contractEventId)
  ) {
    throw new BadRequestError('Ticket does not belong to this on-chain event');
  }

  return {
    owner: normalizeWalletAddress(owner),
    status: chainStatus,
    eventId: String(chainEventId),
  };
}

function validateTransactionHash(txHash) {
  if (!txHash || !ethers.isHexString(txHash, 32)) {
    throw new BadRequestError('Invalid transaction hash');
  }
}

function getRawBlockchainErrorMessage(error) {
  if (!error || typeof error !== 'object') {
    return String(error || 'Unknown blockchain error');
  }

  return (
    error.shortMessage ||
    error.reason ||
    error.message ||
    error.info?.error?.message ||
    error.error?.message ||
    'Unknown blockchain error'
  );
}

function extractBlockchainErrorData(error) {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const queue = [error];
  const visited = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (
      typeof current.data === 'string' &&
      current.data.startsWith('0x') &&
      current.data.length >= 10
    ) {
      return current.data;
    }

    if (current.error) queue.push(current.error);
    if (current.info?.error) queue.push(current.info.error);
    if (current.cause) queue.push(current.cause);
  }

  return null;
}

function mapRefundCustomErrorToMessage(errorName) {
  const messages = {
    InvalidTicketStatus:
      'Ticket is not in a refundable on-chain state for this wallet.',
    RefundsNotEnabled:
      'Refunds are not enabled for this event on-chain yet.',
    InsufficientRefundPool:
      'The event refund pool does not have enough ETH to pay this ticket refund yet.',
    FundNotSet:
      'Ticket contract is not wired to the Fund contract on-chain.',
    EventNotFound: 'The related event was not found on-chain.',
    BadParam: 'Refund parameters are invalid for the current on-chain state.',
    NothingToClaim: 'This ticket refund has already been claimed on-chain.',
    TransferFailed:
      'On-chain refund transfer failed. Please try again or verify contract funding.',
  };

  return messages[errorName] || null;
}

function parseRefundContractError(errorData) {
  const contracts = [getTicket(), getFund()];

  for (const contract of contracts) {
    try {
      if (typeof contract?.interface?.parseError === 'function') {
        const parsedError = contract.interface.parseError(errorData);
        if (parsedError?.name) {
          return parsedError.name;
        }
      }
    } catch {
      // Try the next contract interface.
    }
  }

  return null;
}

function getRefundBlockchainErrorMessage(error) {
  const fallbackMessage = getRawBlockchainErrorMessage(error);

  if (error && typeof error === 'object' && typeof error.revert?.name === 'string') {
    return mapRefundCustomErrorToMessage(error.revert.name) || fallbackMessage;
  }

  const errorData = extractBlockchainErrorData(error);
  if (errorData) {
    const errorName = parseRefundContractError(errorData);
    if (errorName) {
      return mapRefundCustomErrorToMessage(errorName) || fallbackMessage;
    }
  }

  if (String(fallbackMessage).toLowerCase().includes('execution reverted')) {
    return 'Refund transaction reverted on-chain. Verify the ticket is still sold, refunds are enabled, and the refund pool is funded.';
  }

  return fallbackMessage;
}

const TX_RECEIPT_WAIT_TIMEOUT_MS = Number(process.env.TX_RECEIPT_WAIT_TIMEOUT_MS || 120000);

async function getMinedReceipt(txHash) {
  let receipt = await provider.getTransactionReceipt(txHash);
  if (receipt) return receipt;

  try {
    receipt = await provider.waitForTransaction(txHash, 1, TX_RECEIPT_WAIT_TIMEOUT_MS);
  } catch {
    receipt = null;
  }

  return receipt || null;
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

// Check verifier có được assign cho event không
function ensureVerifierAssignedToEvent(event, verifierWallet) {
  const normalizedVerifier = verifierWallet?.toLowerCase();

  if (!normalizedVerifier) {
    throw new ForbiddenError('Verifier wallet is required');
  }

  if (!Array.isArray(event?.verifiers) || event.verifiers.length === 0) {
    throw new ForbiddenError('No verifier is assigned to this event');
  }

  const isAssigned = event.verifiers.some(
    (wallet) => wallet?.toLowerCase() === normalizedVerifier
  );

  if (!isAssigned) {
    throw new ForbiddenError('You are not assigned to this event');
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

async function hydrateMintedTicketFromChain(event, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;
  const ticketContract = getTicket();

  if (!event?.contractEventId) {
    return null;
  }

  const chainEventId = BigInt(event.contractEventId);
  const tokenIds = await ticketContract.getEventTokenIds(chainEventId);

  for (const tokenIdValue of tokenIds || []) {
    const tokenId = toTokenIdString(tokenIdValue);
    if (!tokenId) continue;

    const chainTokenId = BigInt(tokenId);
    const [status, price] = await Promise.all([
      ticketContract.getTicketStatus(chainTokenId),
      ticketContract.getTicketPrice(chainTokenId),
    ]);

    if (status !== ONCHAIN_TICKET_STATUS.MINTED) {
      continue;
    }

    const [owner, ticketInfo] = await Promise.all([
      ticketContract.ownerOf(chainTokenId),
      ticketContract.getTicketInfo(chainTokenId),
    ]);

    const upserted = await ticketRepository.upsertMintedFromChain({
      tokenId,
      eventId: event._id,
      currentOwner: owner,
      originalPrice: price.toString(),
      ticketType: mapChainTicketTypeToDb(ticketInfo?.ticketType),
    });

    if (upserted) {
      return upserted;
    }
  }

  return null;
}

/**
 * Build a primary-sale purchase intent for wallet signing
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
  let event = null;

  if (tokenId) {
    selectedTicket = await ticketRepository.findByTokenId(String(tokenId), { lean: true });
  } else {
    if (!mongoose.isValidObjectId(eventId)) {
      throw new BadRequestError('Invalid event id');
    }

    event = await eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    selectedTicket = await findMintedTicketByEventId(eventId, repos);
    if (!selectedTicket) {
      selectedTicket = await hydrateMintedTicketFromChain(event, repos);
    }
  }

  if (!selectedTicket) {
    throw new NotFoundError('No available minted ticket found');
  }

  if (eventId && String(selectedTicket.eventId) !== String(eventId)) {
    throw new BadRequestError('Ticket does not belong to this event');
  }

  if (!event) {
    event = await eventRepository.findById(selectedTicket.eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }
  }

  ensureEventOpenForTicketing(event);

  const ticketContract = getTicket();
  let chainTokenId = BigInt(selectedTicket.tokenId);
  let [chainStatus, chainPrice] = await Promise.all([
    ticketContract.getTicketStatus(chainTokenId),
    ticketContract.getTicketPrice(chainTokenId),
  ]);

  if (chainStatus !== ONCHAIN_TICKET_STATUS.MINTED && !tokenId) {
    const dbStatus = mapOnchainStatusToDbStatus(chainStatus);
    if (dbStatus) {
      await ticketRepository.updateStatus(selectedTicket.tokenId, dbStatus);
    }

    const refreshedTicket = await hydrateMintedTicketFromChain(event, repos);
    if (!refreshedTicket) {
      throw new NotFoundError('No available minted ticket found');
    }

    selectedTicket = refreshedTicket;
    chainTokenId = BigInt(selectedTicket.tokenId);
    [chainStatus, chainPrice] = await Promise.all([
      ticketContract.getTicketStatus(chainTokenId),
      ticketContract.getTicketPrice(chainTokenId),
    ]);
  }

  if (chainStatus !== ONCHAIN_TICKET_STATUS.MINTED) {
    if (!tokenId) {
      throw new NotFoundError('No available minted ticket found');
    }
    throw new BadRequestError('Ticket is no longer available for primary purchase');
  }

  const [contractAddress, network] = await Promise.all([
    ticketContract.getAddress(),
    provider.getNetwork(),
  ]);

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
      functionName: 'purchaseTicket',
    },
  };
}

/**
 * Confirm a primary-sale purchase transaction and sync DB
 */
export async function confirmPurchaseTransaction(payload = {}, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;
  const eventRepository = repos.eventRepo || eventRepo;

  const { txHash, tokenId, buyerWallet } = payload;

  validateTransactionHash(txHash);

  const receipt = await getMinedReceipt(txHash);
  if (!receipt) {
    throw new BadRequestError('Transaction not mined yet. Please wait a moment and retry.');
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

  if (
    existingTicket.status === 'sold' &&
    existingTicket.currentOwner?.toLowerCase() === buyerFromChain
  ) {
    return {
      synced: false,
      alreadySynced: true,
      txHash: normalizeTxHash(txHash),
      ticket: existingTicket,
    };
  }

  const block = receipt.blockNumber ? await provider.getBlock(receipt.blockNumber) : null;
  const soldAt = block ? new Date(Number(block.timestamp) * 1000) : new Date();

  const updatedTicket = await ticketRepository.markAsSold(purchasedTokenId, {
    buyer: buyerFromChain,
    from: existingTicket.currentOwner,
    soldAt,
    soldTxHash: normalizeTxHash(txHash),
    price: priceFromChain,
  });

  await eventRepository.incrementTicketCounters(existingTicket.eventId, {
    ticketsSold: 1,
  });

  return {
    synced: true,
    alreadySynced: false,
    txHash: normalizeTxHash(txHash),
    ticket: updatedTicket,
  };
}

/**
 * Build ticket use intent for verifier wallet signing
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

  ensureVerifierAssignedToEvent(event, verifierWallet);

  if (event.status !== 'ongoing') {
    throw new BadRequestError('Event must be ongoing for check-in');
  }

  const now = new Date();
  if (now < event.startDate || now > event.endDate) {
    throw new BadRequestError('Current time must be within event dates');
  }

  const ticketContract = getTicket();
  const chainTokenId = BigInt(ticket.tokenId);

  if (!event.contractEventId) {
    throw new BadRequestError('Event is not configured for on-chain check-in');
  }

  const chainEventId = BigInt(event.contractEventId);

  const [chainStatus, isVerifierOnChain, contractAddress, network] = await Promise.all([
    ticketContract.getTicketStatus(chainTokenId),
    ticketContract.isEventVerifier(chainEventId, verifierWallet),
    ticketContract.getAddress(),
    provider.getNetwork(),
  ]);

  if (!isVerifierOnChain) {
    throw new ForbiddenError('Verifier wallet is not authorized on-chain for this event');
  }

  if (chainStatus !== ONCHAIN_TICKET_STATUS.SOLD) {
    throw new BadRequestError('Ticket is not in sold state on-chain');
  }

  const data = ticketContract.interface.encodeFunctionData('markAsUsed', [chainTokenId]);

  return {
    tokenId: ticket.tokenId,
    verifier: verifierWallet.toLowerCase(),
    transaction: {
      to: contractAddress,
      data,
      value: '0',
      chainId: network.chainId.toString(),
      functionName: 'markAsUsed',
    },
  };
}

/**
 * Confirm a ticket check-in transaction and sync DB
 */
export async function confirmUseTicketTransaction(payload = {}, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;
  const eventRepository = repos.eventRepo || eventRepo;

  const { txHash, tokenId, verifierWallet } = payload;

  validateTransactionHash(txHash);

  const receipt = await getMinedReceipt(txHash);
  if (!receipt) {
    throw new BadRequestError('Transaction not mined yet. Please wait a moment and retry.');
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

  const event = await eventRepository.findById(existingTicket.eventId);
  if (!event) {
    throw new NotFoundError('Event not found');
  }

  ensureVerifierAssignedToEvent(event, verifierWallet || verifierFromChain);

  if (existingTicket.status === 'used') {
    return {
      synced: false,
      alreadySynced: true,
      txHash: normalizeTxHash(txHash),
      ticket: existingTicket,
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

  const updatedTicket = await ticketRepository.markAsUsedFromChain(usedTokenId, {
    usedAt: resolvedUsedAt,
    verifiedBy: verifierFromChain,
    usedTxHash: normalizeTxHash(txHash),
  });

  await eventRepository.incrementTicketCounters(existingTicket.eventId, {
    totalTicketsUsed: 1,
  });

  return {
    synced: true,
    alreadySynced: false,
    txHash: normalizeTxHash(txHash),
    ticket: updatedTicket,
  };
}

/**
 * Get tickets with filters and pagination
 */
export async function getTickets(query = {}, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;

  const { eventId, status, owner, page, limit, sort } = query;

  const dbQuery = {
    ...(eventId && { eventId }),
    ...(status && { status }),
    ...(owner && { currentOwner: owner.toLowerCase() }),
  };

  const options = {
    page: page ? parseInt(page, 10) : 1,
    limit: Math.min(limit ? parseInt(limit, 10) : 20, 100),
    sort: sort || '-createdAt',
    lean: true,
  };

  return await ticketRepository.findTickets(dbQuery, options);
}

/**
 * Get ticket by token ID with transfer history
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
 */
export async function getUserTickets(walletAddress, query = {}, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;
  const listingRepository = repos.listingRepo || listingRepo;

  const { page, limit, sort } = query;
  const normalizedWallet = walletAddress.toLowerCase();

  const options = {
    page: page ? parseInt(page, 10) : 1,
    limit: Math.min(limit ? parseInt(limit, 10) : 20, 100),
    sort: sort || '-createdAt',
    lean: true,
    populate: 'eventId',
  };

  const ownedTickets = await ticketRepository.findByOwner(normalizedWallet, options);

  const listedTicketsPage = await listingRepository.findListings(
    { seller: normalizedWallet, status: 'active' },
    {
      page: 1,
      limit: 100,
      sort: '-listedAt',
      lean: true,
      populate: ['ticketId', 'eventId'],
    },
    repos.models,
  );

  const listedTickets = (listedTicketsPage?.docs || [])
    .map((listing) => {
      const ticket = listing?.ticketId;
      if (!ticket || typeof ticket !== 'object') {
        return null;
      }

      const isPopulatedEvent = (value) =>
        value && typeof value === 'object' && 'title' in value;
      const populatedEvent = isPopulatedEvent(listing.eventId)
        ? listing.eventId
        : isPopulatedEvent(ticket.eventId)
          ? ticket.eventId
          : listing.eventId || ticket.eventId;

      return {
        ...ticket,
        isListed: true,
        eventId: populatedEvent,
      };
    })
    .filter(Boolean);

  const mergedByTokenId = new Map();

  for (const ticket of ownedTickets?.docs || []) {
    mergedByTokenId.set(String(ticket.tokenId), ticket);
  }

  for (const ticket of listedTickets) {
    mergedByTokenId.set(String(ticket.tokenId), {
      ...ticket,
      ...(mergedByTokenId.get(String(ticket.tokenId)) || {}),
      isListed: true,
      eventId: ticket.eventId,
    });
  }

  const mergedDocs = Array.from(mergedByTokenId.values());

  return {
    ...(ownedTickets || {}),
    docs: mergedDocs,
    totalDocs: mergedDocs.length,
    totalPages: 1,
    page: 1,
  };
}

/**
 * Verify ticket ownership
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
 */
export async function markTicketAsUsed(tokenId, verifierWallet, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;
  const eventRepository = repos.eventRepo || eventRepo;

  const ticket = await ticketRepository.findByTokenId(tokenId, { lean: false });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  if (ticket.status === 'used') {
    return ticket;
  }

  if (ticket.status !== 'sold') {
    throw new BadRequestError('Ticket must be in sold status to be marked as used');
  }

  const event = await eventRepository.findById(ticket.eventId);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  ensureVerifierAssignedToEvent(event, verifierWallet);

  if (event.status !== 'ongoing') {
    throw new BadRequestError('Event must be in ongoing status');
  }

  const now = new Date();
  if (now < event.startDate || now > event.endDate) {
    throw new BadRequestError('Current time must be within event dates');
  }

  if (event.contractEventId) {
    throw new BadRequestError(
      'This event requires on-chain check-in. Use the use-intent and confirm flow instead.',
    );
  }

  const usageData = {
    usedAt: now,
    verifiedBy: verifierWallet.toLowerCase(),
  };

  const updatedTicket = await ticketRepository.markAsUsed(tokenId, usageData);

  await eventRepository.incrementTicketCounters(ticket.eventId, {
    totalTicketsUsed: 1,
  });

  return updatedTicket;
}

/**
 * Get ticket statistics for an event
 */
export async function getTicketStats(eventId, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;
  const eventRepository = repos.eventRepo || eventRepo;

  if (!mongoose.isValidObjectId(eventId)) {
    throw new BadRequestError('Invalid event id');
  }

  const event = await eventRepository.findById(eventId);
  if (!event) {
    throw new NotFoundError('Event not found');
  }

  if (event.contractEventId) {
    try {
      const ticketContract = getTicket();
      const chainEventId = BigInt(event.contractEventId);
      const chainInfo = await ticketContract.getEventTicketInfo(chainEventId);

      const totalTickets = Number(chainInfo.totalMinted || 0n);
      const soldTickets = Number(chainInfo.totalSold || 0n);
      const usedTickets = Number(chainInfo.totalUsed || 0n);
      const availableTickets = Math.max(totalTickets - soldTickets, 0);

      return {
        totalTickets,
        soldTickets,
        usedTickets,
        mintedTickets: totalTickets,
        availableTickets,
      };
    } catch {
      // Fallback to DB read-model when on-chain call fails.
    }
  }

  const eventObjectId = new mongoose.Types.ObjectId(eventId);
  const stats = await ticketRepository.getTicketStatsByEvent(eventObjectId);

  return {
    totalTickets: stats.total || 0,
    soldTickets: stats.sold || 0,
    usedTickets: stats.used || 0,
    mintedTickets: stats.minted || 0,
    availableTickets: Math.max((stats.minted || 0) - (stats.sold || 0), 0),
  };
}

export async function createRefundIntent(tokenId, buyerWallet, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;
  const eventRepository = repos.eventRepo || eventRepo;

  if (!buyerWallet) {
    throw new BadRequestError('Buyer wallet address is required');
  }

  const ticket = await ticketRepository.findByTokenId(tokenId, { lean: true });
  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  if (ticket.status !== 'sold') {
    throw new BadRequestError('Ticket must be sold before refund claim');
  }

  if (ticket.currentOwner?.toLowerCase() !== buyerWallet.toLowerCase()) {
    throw new ForbiddenError('Only the current ticket owner can claim refund');
  }

  const event = await eventRepository.findById(ticket.eventId);
  if (!event) {
    throw new NotFoundError('Event not found');
  }

  if (event.status !== 'cancelled' && event.status !== 'failed') {
    throw new BadRequestError('Ticket refund is only available for cancelled or failed events');
  }

  const ticketContract = getTicket();
  const marketplaceContract = getMarketplace();
  const chainTokenId = BigInt(ticket.tokenId);
  const [chainStatus, chainOwner, contractAddress, network, activeListingId] = await Promise.all([
    ticketContract.getTicketStatus(chainTokenId),
    ticketContract.ownerOf(chainTokenId),
    ticketContract.getAddress(),
    provider.getNetwork(),
    marketplaceContract.getActiveListingByTokenId(chainTokenId),
  ]);

  const normalizedBuyer = buyerWallet.toLowerCase();
  const normalizedChainOwner = normalizeWalletAddress(chainOwner);
  const normalizedMarketplace = normalizeWalletAddress(
    await marketplaceContract.getAddress(),
  );

  if (
    activeListingId !== 0n ||
    normalizedChainOwner === normalizedMarketplace
  ) {
    throw new BadRequestError(
      'Ticket is still locked in an active marketplace listing on-chain. Cancel or force-cancel the listing before refunding.',
    );
  }

  if (normalizedChainOwner !== normalizedBuyer) {
    throw new BadRequestError(
      'Ticket is not owned by this wallet on-chain, so refund cannot be claimed yet.',
    );
  }

  if (chainStatus !== ONCHAIN_TICKET_STATUS.SOLD) {
    throw new BadRequestError('Ticket is not refundable on-chain');
  }

  const data = ticketContract.interface.encodeFunctionData('claimRefund', [chainTokenId]);

  try {
    await ticketContract.claimRefund.staticCall(chainTokenId, {
      from: buyerWallet,
    });
  } catch (error) {
    throw new BadRequestError(getRefundBlockchainErrorMessage(error));
  }

  return {
    tokenId: ticket.tokenId,
    eventId: String(ticket.eventId),
    buyer: buyerWallet.toLowerCase(),
    refundAmount: String(ticket.originalPrice || '0'),
    transaction: {
      to: contractAddress,
      data,
      value: '0',
      chainId: network.chainId.toString(),
      functionName: 'claimRefund',
    },
  };
}

export async function confirmRefundTransaction(payload = {}, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;

  const { txHash, tokenId, buyerWallet } = payload;

  validateTransactionHash(txHash);

  const receipt = await getMinedReceipt(txHash);
  if (!receipt) {
    throw new BadRequestError('Transaction not mined yet. Please wait a moment and retry.');
  }
  if (Number(receipt.status) !== 1) {
    throw new BadRequestError('Transaction failed on-chain');
  }

  const parsedEvents = await parseTicketEventsFromReceipt(receipt);
  const refundEvents = parsedEvents.filter((event) => event?.name === 'TicketRefunded');

  let matchedEvent = null;

  if (tokenId) {
    matchedEvent = refundEvents.find((event) => {
      const eventTokenId = toTokenIdString(event.args?.tokenId);
      return eventTokenId === String(tokenId);
    });
  } else {
    [matchedEvent] = refundEvents;
  }

  if (!matchedEvent) {
    throw new BadRequestError('TicketRefunded event not found in transaction receipt');
  }

  const refundedTokenId = toTokenIdString(matchedEvent.args?.tokenId);
  const buyerFromChain = String(matchedEvent.args?.owner || '').toLowerCase();

  if (buyerWallet && buyerFromChain !== buyerWallet.toLowerCase()) {
    throw new BadRequestError('Buyer wallet does not match on-chain refund event');
  }

  const existingTicket = await ticketRepository.findByTokenId(refundedTokenId, { lean: true });
  if (!existingTicket) {
    throw new NotFoundError('Ticket not found in database');
  }

  if (existingTicket.status === 'refunded') {
    return {
      synced: false,
      alreadySynced: true,
      txHash: normalizeTxHash(txHash),
      ticket: existingTicket,
    };
  }

  const refundedAt = receipt.blockNumber
    ? new Date(Number((await provider.getBlock(receipt.blockNumber)).timestamp) * 1000)
    : new Date();

  const updatedTicket = await ticketRepository.markAsRefundedFromChain(
    refundedTokenId,
    {
      refundedAt,
      refundedTxHash: normalizeTxHash(txHash),
    },
  );

  return {
    synced: true,
    alreadySynced: false,
    txHash: normalizeTxHash(txHash),
    ticket: updatedTicket,
  };
}

/**
 * Verify ticket ownership and return ticket details
 */
export async function verifyTicket(tokenId, eventId, walletAddress, verifierWallet, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;
  const eventRepository = repos.eventRepo || eventRepo;

  const ticket = await ticketRepository.findByTokenId(tokenId, { lean: false });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  if (eventId && String(ticket.eventId) !== String(eventId)) {
    throw new BadRequestError('Ticket does not belong to this event');
  }

  const event = await eventRepository.findById(ticket.eventId);
  if (!event) {
    throw new NotFoundError('Event not found');
  }

  ensureVerifierAssignedToEvent(event, verifierWallet);

  if (event.status !== 'ongoing') {
    throw new BadRequestError('Event must be ongoing for ticket verification');
  }

  const now = new Date();
  if (now < event.startDate || now > event.endDate) {
    throw new BadRequestError('Current time must be within event dates');
  }

  let resolvedOwner = normalizeWalletAddress(ticket.currentOwner);

  if (event.contractEventId) {
    const chainSnapshot = await getOnChainTicketSnapshot(ticket.tokenId, event);

    if (chainSnapshot.status !== ONCHAIN_TICKET_STATUS.SOLD) {
      throw new BadRequestError('Ticket is not in sold state on-chain');
    }

    resolvedOwner = chainSnapshot.owner;
  }

  const normalizedWallet = normalizeWalletAddress(walletAddress);
  const isOwner = normalizedWallet
    ? resolvedOwner === normalizedWallet
    : !!resolvedOwner;

  return {
    isOwner,
    ownerWallet: resolvedOwner,
    ticket,
  };
}
