import { ethers } from "ethers";

import { provider } from "../../core/provider.js";
import { getFund } from "../../core/contracts/index.js";
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

const CONTRACT_NAME = "Fund";

function sanitizeForMongo(value) {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return ethers.hexlify(value);
  if (Array.isArray(value)) return value.map(sanitizeForMongo);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeForMongo(v);
    return out;
  }
  return value;
}

function resultToArgsObject(result) {
  if (!result) return undefined;

  const out = {};
  for (const [k, v] of Object.entries(result)) {
    if (/^\d+$/.test(k)) continue;
    out[k] = sanitizeForMongo(v);
  }

  if (Object.keys(out).length === 0) {
    for (let i = 0; i < result.length; i += 1) {
      out[String(i)] = sanitizeForMongo(result[i]);
    }
  }

  return out;
}

async function deleteLogsInRange(contractAddress, fromBlock, toBlock) {
  await ChainLog.deleteMany({
    contractAddress: contractAddress.toLowerCase(),
    blockNumber: { $gte: fromBlock, $lte: toBlock },
  });
}

async function storeLogs(contractAddress, logs) {
  if (logs.length === 0) return;

  const fund = getFund();

  const docs = logs.map((log) => {
    let parsed;
    try {
      parsed = fund.interface.parseLog({ topics: log.topics, data: log.data });
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
      args: parsed?.args ? resultToArgsObject(parsed.args) : undefined,
    };
  });

  await ChainLog.insertMany(docs, { ordered: false });
}

export async function syncFundLogsOnce() {
  const fund = getFund();
  const { confirmations, reorgBuffer, chunkSize } = readReorgPolicyFromEnv();
  const startBlock = getNumberEnv("FUND_START_BLOCK", 0);

  const contractAddress = await fund.getAddress();
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
    return { latest, target, processedTo: syncState.lastProcessedBlock };
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

  return { latest, target, processedTo: target };
}

export async function runFundIndexerLoop() {
  const intervalMs = getNumberEnv("CHAIN_SYNC_INTERVAL_MS", 10_000);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await syncFundLogsOnce();
    } catch (err) {
      await markError(CONTRACT_NAME, err);
      // eslint-disable-next-line no-console
      console.error("Fund indexer error:", err);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
}