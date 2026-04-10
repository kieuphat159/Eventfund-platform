import { provider } from "../core/provider.js";
import { getMarketplace } from "../core/contracts/index.js";
import {
  getOrInitSyncState,
  markError,
  markSynced,
  markSyncing,
  updateProgress,
} from "../core/blockTracker.js";
import {
  getNumberEnv,
  planReorgSafeSync,
  readReorgPolicyFromEnv,
} from "../sync/reorgPolicy.js";

// ==================== REPOSITORIES ====================
import chainLogRepo from "../../../repositories/chainLog.repo.js";
import listingRepo from "../../../repositories/listing.repo.js";
import * as ticketRepo from "../../../repositories/ticket.repo.js";

const CONTRACT_NAME = "Marketplace";
const PROCESSOR_NAME = "MarketplaceProcessor";

// -------------------------
// Helper utils
// -------------------------
function toStringId(value) {
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? value : String(value);
}

function lowerAddress(value) {
  if (!value) return undefined;
  return String(value).toLowerCase();
}

function mapMarketplaceEvent(chainLog, contractAddressLower) {
  const eventName = chainLog.eventName || "Unknown";
  const args = chainLog.args || {};

  const base = {
    contractAddress: contractAddressLower,
    blockNumber: chainLog.blockNumber,
    transactionHash: chainLog.transactionHash,
    logIndex: chainLog.logIndex,
  };

  switch (eventName) {
    case "ListingCreated":
      return {
        ...base,
        eventName,
        contractListingId: toStringId(args.listingId), // on-chain ID
        tokenId: toStringId(args.tokenId),
        seller: lowerAddress(args.seller),
        price: toStringId(args.price),       // mapped to schema field
        maxPrice: toStringId(args.maxPrice), // mapped to schema field
        status: "active",
      };

    case "ListingSold":
      return {
        ...base,
        eventName,
        contractListingId: toStringId(args.listingId),
        tokenId: toStringId(args.tokenId),
        buyer: lowerAddress(args.buyer),
        seller: lowerAddress(args.seller),
        price: toStringId(args.price),       // mapped to schema field
        royaltyWei: toStringId(args.royaltyAmount),
        status: "sold",
      };

    case "ListingCancelled":
      return {
        ...base,
        eventName,
        contractListingId: toStringId(args.listingId),
        tokenId: toStringId(args.tokenId),
        seller: lowerAddress(args.seller),
        status: "cancelled",
      };

    default:
      return null;
  }
}

// -------------------------
// MAIN PROCESSOR LOGIC
// -------------------------
async function processMarketplaceLog(log) {
  const contractAddressLower = log.contractAddress?.toLowerCase() || "";
  const event = mapMarketplaceEvent(log, contractAddressLower);

  if (!event) return;

  switch (event.eventName) {
    case "ListingCreated": {
      // Resolve ticketId and eventId from tokenId
      const ticket = await ticketRepo.findByTokenId(event.tokenId);
      await listingRepo.upsertListingCreated({
        ...event,
        ticketId: ticket?._id,
        eventId: ticket?.eventId,
      });
      break;
    }

    case "ListingSold": {
      const ticket = await ticketRepo.findByTokenId(event.tokenId);
      await listingRepo.upsertListingSold({
        ...event,
        ticketId: ticket?._id,
        eventId: ticket?.eventId,
      });
      break;
    }

    case "ListingCancelled":
      await listingRepo.updateListingCancelled(event.contractListingId);
      break;

    default:
      break;
  }
}

export async function processMarketplaceLogsOnce() {
  const marketplace = getMarketplace();

  const { confirmations, reorgBuffer, chunkSize } = readReorgPolicyFromEnv();

  const startBlock = getNumberEnv("MARKETPLACE_START_BLOCK", 0);

  const contractAddress = await marketplace.getAddress();
  const contractAddressLower = contractAddress.toLowerCase();

  const syncState = await getOrInitSyncState({
    contractName: PROCESSOR_NAME,
    contractAddress,
    startBlock,
  });

  const latest = await provider.getBlockNumber();

  const plan = planReorgSafeSync({
    latestBlock: latest,
    confirmations,
    startBlock,
    lastProcessedBlock: syncState.lastProcessedBlock,
    reorgBuffer,
  });

  const target = plan.targetBlock;

  if (!plan.shouldSync) {
    return { latest, target };
  }

  const from = plan.fromBlock;

  await markSyncing(PROCESSOR_NAME);

  let currentFrom = from;

  while (currentFrom <= target) {
    const currentTo = Math.min(target, currentFrom + chunkSize - 1);

    const logs = await chainLogRepo.findLogs({
      contractName: CONTRACT_NAME,
      contractAddress: contractAddressLower,
      blockNumber: { $gte: currentFrom, $lte: currentTo },
      eventName: { $ne: null },
    }, {
      sort: { blockNumber: 1, logIndex: 1 }
    });

    for (const log of logs) {
      await processMarketplaceLog(log);
    }

    await updateProgress({
      contractName: PROCESSOR_NAME,
      contractAddress,
      lastProcessedBlock: currentTo,
      status: "syncing",
    });

    currentFrom = currentTo + 1;
  }

  await markSynced(PROCESSOR_NAME);

  return { latest, target };
}

export async function runMarketplaceProcessorLoop() {
  const intervalMs = getNumberEnv("CHAIN_PROCESS_INTERVAL_MS", 10000);

  while (true) {
    try {
      await processMarketplaceLogsOnce();
    } catch (err) {
      await markError(PROCESSOR_NAME, err);
      console.error("Marketplace processor error:", err);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
}