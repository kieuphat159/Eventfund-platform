import { ChainLog } from "../../../models/ChainLog.js";
import Listing from "../../../models/Listing.model.js";

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

const CONTRACT_NAME = "Marketplace";
const PROCESSOR_NAME = "MarketplaceProcessor";

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
        listingId: toStringId(args.listingId),
        tokenId: toStringId(args.tokenId),
        seller: lowerAddress(args.seller),
        priceWei: toStringId(args.price),
        maxPriceWei: toStringId(args.maxPrice),
        status: "active",
      };

    case "ListingSold":
      return {
        ...base,
        eventName,
        listingId: toStringId(args.listingId),
        tokenId: toStringId(args.tokenId),
        buyer: lowerAddress(args.buyer),
        seller: lowerAddress(args.seller),
        priceWei: toStringId(args.price),
        royaltyWei: toStringId(args.royaltyAmount),
        status: "sold",
      };

    case "ListingCancelled":
      return {
        ...base,
        eventName,
        listingId: toStringId(args.listingId),
        tokenId: toStringId(args.tokenId),
        seller: lowerAddress(args.seller),
        status: "cancelled",
      };

    default:
      return null;
  }
}

async function processMarketplaceLogs(contractAddressLower, logs) {
  for (const log of logs) {
    const event = mapMarketplaceEvent(log, contractAddressLower);
    if (!event) continue;

    if (event.eventName === "ListingCreated") {
      await Listing.create({
        listingId: event.listingId,
        tokenId: event.tokenId,
        seller: event.seller,
        priceWei: event.priceWei,
        maxPriceWei: event.maxPriceWei,
        status: "active",
        blockNumber: event.blockNumber,
      });
    }

    if (event.eventName === "ListingSold") {
      await Listing.updateOne(
        { listingId: event.listingId },
        {
          $setOnInsert: {
            tokenId: event.tokenId,
            seller: event.seller,
            priceWei: event.priceWei,
            maxPriceWei: event.maxPriceWei,
            status: "active",
            blockNumber: event.blockNumber,
          },
        },
        { upsert: true },
      );
    }

    if (event.eventName === "ListingCancelled") {
      await Listing.updateOne(
        { listingId: event.listingId },
        {
          $set: {
            status: "cancelled",
          },
        },
      );
    }
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

    const logs = await ChainLog.find({
      contractName: CONTRACT_NAME,
      contractAddress: contractAddressLower,
      blockNumber: { $gte: currentFrom, $lte: currentTo },
      eventName: { $ne: null },
    })
      .sort({ blockNumber: 1, logIndex: 1 })
      .lean();

    await processMarketplaceLogs(contractAddressLower, logs);

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
