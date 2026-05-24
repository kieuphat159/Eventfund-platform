import { ethers } from "ethers";

import * as ticketRepo from "../../repositories/ticket.repo.js";
import * as listingRepo from "../../repositories/listing.repo.js";
import { persistLogsFromReceipt } from "../blockchain/core/receiptChainLog.js";
import { EventQueue } from "../blockchain/processors/eventQueue.js";
import { getFund, getMarketplace, getTicket, provider } from "../blockchain/index.js";

const ONCHAIN_TICKET_STATUS = {
  MINTED: 0n,
  SOLD: 1n,
  USED: 2n,
  EXPIRED: 3n,
  REFUNDED: 4n,
};

const AUTO_REFUND_WAIT_CONFIRMATIONS = Math.max(
  1,
  Number(process.env.AUTO_TICKET_REFUND_WAIT_CONFIRMATIONS || 1),
);
const FORCE_CANCEL_LISTING_INTERFACE = new ethers.Interface([
  "function forceCancelListing(uint256 listingId)",
]);

const autoRefundQueue = new EventQueue({
  name: "AutoTicketRefundQueue",
  concurrency: 1,
});
autoRefundQueue.start();

const queuedEventKeys = new Set();

function isAutoRefundEnabled() {
  const raw = String(
    process.env.AUTO_TICKET_REFUND_ENABLED ?? "true",
  ).trim().toLowerCase();

  return !["0", "false", "off", "no"].includes(raw);
}

function getBackendSigner() {
  const privateKey = process.env.BACKEND_SIGNER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "Missing BACKEND_SIGNER_PRIVATE_KEY for automatic ticket refunds",
    );
  }

  return new ethers.Wallet(privateKey, provider);
}

function toEventKey(eventDoc) {
  if (eventDoc?._id) return String(eventDoc._id);
  if (eventDoc?.contractEventId) return `chain:${eventDoc.contractEventId}`;
  return null;
}

function toTokenIdString(value) {
  if (value === undefined || value === null) return "";
  return typeof value === "bigint" ? value.toString() : String(value);
}

async function persistRefundReceipt(receipt, logger) {
  const [ticketContract, fundContract] = [getTicket(), getFund()];
  const [ticketAddress, fundAddress] = await Promise.all([
    ticketContract.getAddress(),
    fundContract.getAddress(),
  ]);

  await Promise.all([
    persistLogsFromReceipt({
      receipt,
      contract: ticketContract,
      contractName: "Ticket",
      contractAddress: ticketAddress,
    }),
    persistLogsFromReceipt({
      receipt,
      contract: fundContract,
      contractName: "Fund",
      contractAddress: fundAddress,
    }),
  ]);

  logger.info?.(
    `[auto-refund] persisted receipt logs for tx ${receipt?.hash || "unknown"}`,
  );
}

async function persistMarketplaceReceipt(receipt, logger) {
  const marketplaceContract = getMarketplace();
  const marketplaceAddress = await marketplaceContract.getAddress();

  await persistLogsFromReceipt({
    receipt,
    contract: marketplaceContract,
    contractName: "Marketplace",
    contractAddress: marketplaceAddress,
  });

  logger.info?.(
    `[auto-refund] persisted marketplace receipt logs for tx ${receipt?.hash || "unknown"}`,
  );
}

async function syncRefundedTicketRecord(tokenId, txHash, repositories = {}) {
  const ticketRepository = repositories.ticketRepo || ticketRepo;
  const refundData = {
    refundedAt: new Date(),
  };

  if (txHash) {
    refundData.refundedTxHash = txHash;
  }

  await ticketRepository.markAsRefundedFromChain(tokenId, refundData);
}

async function autoCancelActiveListingsForEvent(eventDoc, options = {}) {
  const logger = options.logger || console;
  const repositories = options.repositories || {};
  const listingRepository = repositories.listingRepo || listingRepo;
  const ticketRepository = repositories.ticketRepo || ticketRepo;
  const signer = options.signer || getBackendSigner();
  const marketplaceContract = options.marketplaceContract || getMarketplace();
  const marketplaceAddress = await marketplaceContract.getAddress();

  const blockedTokenIds = new Set();
  const result = {
    inspected: 0,
    cancelled: 0,
    failed: 0,
  };
  const chainEventId = BigInt(eventDoc.contractEventId);
  const ticketIds = await (options.ticketContract || getTicket()).getEventTokenIds(
    chainEventId,
  );

  for (const tokenIdValue of ticketIds || []) {
    const tokenId = toTokenIdString(tokenIdValue);
    if (!tokenId) continue;

    let activeListingId = 0n;
    try {
      activeListingId = await marketplaceContract.getActiveListingByTokenId(
        BigInt(tokenId),
      );
    } catch (error) {
      result.failed += 1;
      blockedTokenIds.add(tokenId);
      logger.error?.(
        `[auto-refund] failed to inspect active marketplace listing for token ${tokenId}: ${error?.message || error}`,
      );
      continue;
    }

    if (activeListingId === 0n) {
      continue;
    }

    result.inspected += 1;

    let listingDetails;
    try {
      listingDetails = await marketplaceContract.getListing(activeListingId);
    } catch (error) {
      result.failed += 1;
      blockedTokenIds.add(tokenId);
      logger.error?.(
        `[auto-refund] failed to load on-chain listing ${activeListingId.toString()} for token ${tokenId}: ${error?.message || error}`,
      );
      continue;
    }

    const seller = String(listingDetails?.seller || "").toLowerCase();
    const contractListingId = activeListingId.toString();

    try {
      const tx = await signer.sendTransaction({
        to: marketplaceAddress,
        data: FORCE_CANCEL_LISTING_INTERFACE.encodeFunctionData(
          "forceCancelListing",
          [activeListingId],
        ),
      });
      const receipt = await tx.wait(AUTO_REFUND_WAIT_CONFIRMATIONS);

      if (!receipt || Number(receipt.status) !== 1) {
        throw new Error("Automatic marketplace cancellation failed on-chain");
      }

      result.cancelled += 1;

      try {
        await persistMarketplaceReceipt(receipt, logger);
      } catch (error) {
        logger.error?.(
          `[auto-refund] failed to persist marketplace receipt for listing ${contractListingId}: ${error?.message || error}`,
        );
      }

      const existingListing = await listingRepository.findListings(
        {
          $or: [
            { contractListingId },
            { tokenId, status: "active" },
          ],
        },
        { page: 1, limit: 1, sort: "-listedAt", lean: true },
        repositories.models,
      );
      const listingDoc = existingListing?.docs?.[0];

      const updates = [
        ticketRepository.updateStatus(
          tokenId,
          "sold",
          {
            currentOwner: seller,
            isListed: false,
          },
          repositories.models,
        ),
      ];

      if (listingDoc?._id) {
        updates.push(
          listingRepository.updateStatus(
            listingDoc._id,
            "cancelled",
            {},
            repositories.models,
          ),
        );
      }

      await Promise.all(updates);

      logger.info?.(
        `[auto-refund] force-cancelled marketplace listing ${contractListingId} for token ${tokenId} in tx ${tx.hash}`,
      );
    } catch (error) {
      result.failed += 1;
      blockedTokenIds.add(tokenId);
      logger.error?.(
        `[auto-refund] failed to force-cancel marketplace listing ${contractListingId} for token ${tokenId}: ${error?.message || error}`,
      );
    }
  }

  return {
    ...result,
    blockedTokenIds,
  };
}

export async function autoRefundCancelledEvent(eventDoc, options = {}) {
  const logger = options.logger || console;

  if (!isAutoRefundEnabled()) {
    return {
      skipped: true,
      reason: "disabled",
    };
  }

  if (!eventDoc?.contractEventId) {
    return {
      skipped: true,
      reason: "missing_contract_event_id",
    };
  }

  const signer = options.signer || getBackendSigner();
  const ticketContract = options.ticketContract || getTicket();
  const ticketWithSigner =
    typeof ticketContract.connect === "function"
      ? ticketContract.connect(signer)
      : ticketContract;

  const chainEventId = BigInt(eventDoc.contractEventId);
  const tokenIds = await ticketContract.getEventTokenIds(chainEventId);
  const cancellationResult = await autoCancelActiveListingsForEvent(
    eventDoc,
    options,
  );
  const result = {
    eventId: String(eventDoc._id || eventDoc.contractEventId),
    inspected: 0,
    listingsInspected: cancellationResult.inspected,
    listingsCancelled: cancellationResult.cancelled,
    listingCancellationFailed: cancellationResult.failed,
    refunded: 0,
    alreadyRefunded: 0,
    skipped: 0,
    failed: 0,
  };

  for (const tokenIdValue of tokenIds || []) {
    const tokenId = toTokenIdString(tokenIdValue);
    if (!tokenId) continue;

    result.inspected += 1;

    if (cancellationResult.blockedTokenIds.has(tokenId)) {
      result.skipped += 1;
      logger.error?.(
        `[auto-refund] skipping refund for token ${tokenId} because active marketplace listing could not be force-cancelled first`,
      );
      continue;
    }

    try {
      const chainStatus = await ticketContract.getTicketStatus(BigInt(tokenId));

      if (chainStatus === ONCHAIN_TICKET_STATUS.REFUNDED) {
        result.alreadyRefunded += 1;
        try {
          await syncRefundedTicketRecord(tokenId, undefined, options.repositories);
        } catch (error) {
          logger.error?.(
            `[auto-refund] failed to sync already-refunded token ${tokenId}: ${error?.message || error}`,
          );
        }
        continue;
      }

      if (chainStatus !== ONCHAIN_TICKET_STATUS.SOLD) {
        result.skipped += 1;
        continue;
      }

      const tx = await ticketWithSigner.claimRefundFor(BigInt(tokenId));
      const receipt = await tx.wait(AUTO_REFUND_WAIT_CONFIRMATIONS);

      if (!receipt || Number(receipt.status) !== 1) {
        throw new Error("Automatic refund transaction failed on-chain");
      }

      result.refunded += 1;

      try {
        await persistRefundReceipt(receipt, logger);
      } catch (error) {
        logger.error?.(
          `[auto-refund] failed to persist logs for token ${tokenId}: ${error?.message || error}`,
        );
      }

      try {
        await syncRefundedTicketRecord(tokenId, tx.hash, options.repositories);
      } catch (error) {
        logger.error?.(
          `[auto-refund] failed to sync refunded token ${tokenId}: ${error?.message || error}`,
        );
      }

      logger.info?.(
        `[auto-refund] refunded token ${tokenId} for event ${eventDoc.contractEventId} in tx ${tx.hash}`,
      );
    } catch (error) {
      result.failed += 1;
      logger.error?.(
        `[auto-refund] failed token ${tokenId} for event ${eventDoc.contractEventId}: ${error?.message || error}`,
      );
    }
  }

  return result;
}

export function scheduleAutoRefundForCancelledEvent(eventDoc, options = {}) {
  const logger = options.logger || console;
  const eventKey = toEventKey(eventDoc);

  if (!isAutoRefundEnabled() || !eventKey) {
    return null;
  }

  if (queuedEventKeys.has(eventKey)) {
    return null;
  }

  queuedEventKeys.add(eventKey);

  const task = autoRefundQueue.enqueue(async () => {
    try {
      return await autoRefundCancelledEvent(eventDoc, options);
    } finally {
      queuedEventKeys.delete(eventKey);
    }
  });

  task.catch((error) => {
    logger.error?.(
      `[auto-refund] event ${eventKey} crashed: ${error?.message || error}`,
    );
  });

  return task;
}

export function resetAutoRefundQueueForTests() {
  queuedEventKeys.clear();
  autoRefundQueue.clear();
}
