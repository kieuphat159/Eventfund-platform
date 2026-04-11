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
// REBUILD LISTING FROM CHAINLOG (dung khi detect reorg)
// Replay tat ca ChainLog cua 1 contractListingId de tinh lai state
// -------------------------
async function rebuildListingFromChainLog(contractListingId, contractAddressLower) {
  const logs = await chainLogRepo.findLogs(
    {
      contractName: CONTRACT_NAME,
      contractAddress: contractAddressLower,
      "args.listingId": contractListingId,
    },
    { sort: { blockNumber: 1, logIndex: 1 } }
  );

  if (logs.length === 0) {
    // Khong con ChainLog nao → listing bi reorg hoan toan → xoa
    await listingRepo.deleteByContractListingId(contractListingId);
    return;
  }

  // Replay tung log theo thu tu
  for (const log of logs) {
    await processMarketplaceLog(log);
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

  // Build map blockNumber -> { blockHash, contractListingIds } tu recentBlockHashes da luu
  const savedBlockHashMap = new Map(
    (syncState.recentBlockHashes || []).map(({ blockNumber, blockHash, contractListingIds }) => [
      blockNumber,
      { blockHash, contractListingIds: contractListingIds || [] },
    ])
  );

  const reorgAffectedListingIds = new Set();

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

    // ── Reorg detection ────────────────────────────────────────────────────
    if (savedBlockHashMap.size > 0) {
      const currentBlockHashMap = new Map();
      for (const log of logs) {
        if (!currentBlockHashMap.has(log.blockNumber)) {
          currentBlockHashMap.set(log.blockNumber, log.blockHash);
        }
      }

      for (const [blockNum, savedEntry] of savedBlockHashMap) {
        if (blockNum < currentFrom || blockNum > currentTo) continue;

        const currentHash = currentBlockHashMap.get(blockNum);

        if (currentHash === undefined) {
          // Block bien mat → collect contractListingIds bi anh huong
          console.log(`[MarketplaceProcessor] Reorg: block ${blockNum} disappeared`);
          for (const lid of (savedEntry.contractListingIds || [])) {
            reorgAffectedListingIds.add(lid);
          }
        } else if (currentHash !== savedEntry.blockHash) {
          // Block co blockHash khac → collect ca listingIds cu va canonical moi
          console.log(`[MarketplaceProcessor] Reorg: block ${blockNum} hash changed`);
          for (const lid of (savedEntry.contractListingIds || [])) {
            reorgAffectedListingIds.add(lid);
          }
          for (const log of logs) {
            if (log.blockNumber === blockNum) {
              const lid = toStringId(log.args?.listingId);
              if (lid) reorgAffectedListingIds.add(lid);
            }
          }
        }
      }
    }

    for (const log of logs) {
      await processMarketplaceLog(log);
    }

    // Cap nhat recentBlockHashes voi contractListingIds
    const newBlockHashes = [];
    for (const log of logs) {
      let entry = newBlockHashes.find(b => b.blockNumber === log.blockNumber);
      if (!entry) {
        entry = { blockNumber: log.blockNumber, blockHash: log.blockHash, contractListingIds: [] };
        newBlockHashes.push(entry);
      }
      const lid = toStringId(log.args?.listingId);
      if (lid && !entry.contractListingIds.includes(lid)) {
        entry.contractListingIds.push(lid);
      }
    }

    const mergedFullMap = new Map();
    for (const [blockNumber, entry] of savedBlockHashMap) {
      mergedFullMap.set(blockNumber, entry);
    }
    for (const entry of newBlockHashes) {
      mergedFullMap.set(entry.blockNumber, { blockHash: entry.blockHash, contractListingIds: entry.contractListingIds });
    }
    const sortedEntries = [...mergedFullMap.entries()]
      .sort(([a], [b]) => b - a)
      .slice(0, reorgBuffer);
    const updatedRecentBlockHashes = sortedEntries.map(([blockNumber, entry]) => ({
      blockNumber,
      blockHash: entry.blockHash,
      contractListingIds: entry.contractListingIds,
    }));

    savedBlockHashMap.clear();
    for (const [blockNumber, entry] of sortedEntries) {
      savedBlockHashMap.set(blockNumber, entry);
    }

    await updateProgress({
      contractName: PROCESSOR_NAME,
      contractAddress,
      lastProcessedBlock: currentTo,
      recentBlockHashes: updatedRecentBlockHashes,
      status: "syncing",
    });

    currentFrom = currentTo + 1;
  }

  // ── Rebuild listings bi anh huong boi reorg ────────────────────────────
  if (reorgAffectedListingIds.size > 0) {
    console.log(`[MarketplaceProcessor] Rebuilding ${reorgAffectedListingIds.size} listing(s) due to reorg...`);
    for (const contractListingId of reorgAffectedListingIds) {
      await rebuildListingFromChainLog(contractListingId, contractAddressLower);
    }
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