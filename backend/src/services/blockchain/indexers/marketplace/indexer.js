import { ethers } from "ethers";

import { provider } from "../../core/provider.js";
import { getMarketplace } from "../../core/contracts/index.js";
import { ChainLog } from "../../../../models/ChainLog.js";
import {
  getNumberEnv,
  planReorgSafeSync,
  readReorgPolicyFromEnv,
} from "../../sync/reorgPolicy.js";
import {
  getOrInitSyncState,
  markError,
  markSynced,
  markSyncing,
  updateProgress,
} from "../../core/blockTracker.js";

const CONTRACT_NAME = "Marketplace";

function sanitizeForMongo(value) {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return ethers.hexlify(value);
  if (Array.isArray(value)) return value.map(sanitizeForMongo);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeForMongo(v);
    }
    return out;
  }
  return value;
}

function resultToArgsObject(eventName, result) {
  if (!result) return undefined;

  const out = {};

  for (const [k, v] of Object.entries(result)) {
    if (/^\d+$/.test(k)) continue;
    out[k] = sanitizeForMongo(v);
  }

  if (Object.keys(out).length > 0) {
    return out;
  }

  const values = [];
  for (let i = 0; i < result.length; i += 1) {
    values.push(sanitizeForMongo(result[i]));
  }

  switch (eventName) {
    case "ListingCreated":
      return {
        listingId: values[0],
        tokenId: values[1],
        seller: values[2],
        price: values[3],
        maxPrice: values[4],
      };

    case "ListingSold":
      return {
        listingId: values[0],
        tokenId: values[1],
        buyer: values[2],
        seller: values[3],
        price: values[4],
        royaltyAmount: values[5],
      };

    case "ListingCancelled":
      return {
        listingId: values[0],
        tokenId: values[1],
        seller: values[2],
      };

    default: {
      const indexed = {};
      for (let i = 0; i < values.length; i += 1) {
        indexed[String(i)] = values[i];
      }
      return indexed;
    }
  }
}

async function deleteLogsInRange(contractAddress, fromBlock, toBlock) {
  await ChainLog.deleteMany({
    contractName: CONTRACT_NAME,
    contractAddress: contractAddress.toLowerCase(),
    blockNumber: { $gte: fromBlock, $lte: toBlock },
  });
}

async function storeLogs(contractAddress, logs) {
  if (logs.length === 0) return;

  const marketplace = getMarketplace();

  const docs = logs.map((log) => {
    let parsed;
    try {
      parsed = marketplace.interface.parseLog({
        topics: log.topics,
        data: log.data,
      });
    } catch {
      parsed = undefined;
    }

    return {
      contractName: CONTRACT_NAME,
      contractAddress: contractAddress.toLowerCase(),
      blockNumber: log.blockNumber,
      blockHash: log.blockHash,
      transactionHash: log.transactionHash,
      transactionIndex: log.transactionIndex,
      logIndex: log.index,
      topics: log.topics,
      data: log.data,
      eventName: parsed?.name,
      args: parsed?.args
        ? resultToArgsObject(parsed.name, parsed.args)
        : undefined,
    };
  });

  await ChainLog.insertMany(docs, { ordered: false });
}

export async function syncMarketplaceLogsOnce() {
  const marketplace = getMarketplace();
  const { confirmations, reorgBuffer, chunkSize } = readReorgPolicyFromEnv();
  const startBlock = getNumberEnv("MARKETPLACE_START_BLOCK", 0);

  const contractAddress = await marketplace.getAddress();
  const contractAddressLower = contractAddress.toLowerCase();

  const syncState = await getOrInitSyncState({
    contractName: CONTRACT_NAME,
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
    return {
      latest,
      target,
      processedTo: syncState.lastProcessedBlock,
    };
  }

  const from = plan.fromBlock;

  await markSyncing(CONTRACT_NAME);

  let currentFrom = from;
  while (currentFrom <= target) {
    const currentTo = Math.min(target, currentFrom + chunkSize - 1);

    await deleteLogsInRange(contractAddressLower, currentFrom, currentTo);

    const logs = await provider.getLogs({
      address: contractAddressLower,
      fromBlock: currentFrom,
      toBlock: currentTo,
    });

    await storeLogs(contractAddressLower, logs);

    await updateProgress({
      contractName: CONTRACT_NAME,
      contractAddress,
      lastProcessedBlock: currentTo,
      status: "syncing",
    });

    currentFrom = currentTo + 1;
  }

  await markSynced(CONTRACT_NAME);

  return {
    latest,
    target,
    processedTo: target,
  };
}

export async function runMarketplaceIndexerLoop() {
  const intervalMs = getNumberEnv("CHAIN_SYNC_INTERVAL_MS", 10_000);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await syncMarketplaceLogsOnce();
    } catch (err) {
      await markError(CONTRACT_NAME, err);
      console.error("Marketplace indexer error:", err);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
}