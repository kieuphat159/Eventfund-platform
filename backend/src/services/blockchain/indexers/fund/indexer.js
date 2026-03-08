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
    case "EventCreated":
      return {
        eventId: values[0],
        organizer: values[1],
        stakeAmount: values[2],
        minStakeRequired: values[3],
        fundingGoal: values[4],
        fundingDeadline: values[5],
        organizerShareBps: values[6],
        ticketPrice: values[7],
        maxTickets: values[8],
        usedThreshold: values[9],
      };

    case "ContributionMade":
      return {
        eventId: values[0],
        donator: values[1],
        amount: values[2],
      };

    case "SharesIssued":
      return {
        eventId: values[0],
        donator: values[1],
        sharesMinted: values[2],
      };

    case "FundingSuccessful":
      return {
        eventId: values[0],
      };

    case "FundingFinalized":
      return {
        eventId: values[0],
        totalShares: values[1],
        statusAfterFinalize: values[2],
      };

    case "TicketingStarted":
      return {
        eventId: values[0],
        mintedQty: values[1],
        ticketType: values[2],
      };

    case "Completed":
      return {
        eventId: values[0],
        usedTickets: values[1],
      };

    case "RevenueReleased":
      return {
        eventId: values[0],
        totalRevenue: values[1],
        platformFee: values[2],
        organizerShare: values[3],
        donatorPool: values[4],
        newAccRewardPerShare: values[5],
      };

    case "RewardClaimed":
      return {
        eventId: values[0],
        donator: values[1],
        amount: values[2],
      };

    case "RefundsEnabled":
      return {
        eventId: values[0],
        refundPoolAmount: values[1],
      };

    case "TicketRefundPaid":
      return {
        eventId: values[0],
        tokenId: values[1],
        to: values[2],
        amount: values[3],
      };

    case "RefundPoolDeposited":
      return {
        eventId: values[0],
        from: values[1],
        amount: values[2],
        newRefundPool: values[3],
      };

    case "PenaltyApplied":
      return {
        eventId: values[0],
        amount: values[1],
        penaltyBps: values[2],
        reason: values[3],
      };

    case "TicketRevenueDeposited":
      return {
        eventId: values[0],
        from: values[1],
        amount: values[2],
        newEscrowedRevenue: values[3],
      };

    case "RoyaltyDeposited":
      return {
        eventId: values[0],
        from: values[1],
        amount: values[2],
        newEscrowedRevenue: values[3],
      };

    case "ContributionRefunded":
      return {
        eventId: values[0],
        donator: values[1],
        amount: values[2],
      };

    case "StakeWithdrawn":
      return {
        eventId: values[0],
        organizer: values[1],
        amount: values[2],
      };

    case "TicketContractSet":
      return {
        ticket: values[0],
      };

    case "MarketplaceContractSet":
      return {
        marketplace: values[0],
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
  const deleted = await ChainLog.deleteMany({
    contractAddress: contractAddress.toLowerCase(),
    blockNumber: { $gte: fromBlock, $lte: toBlock },
  });

  console.log(
    `[fund.indexer] deleted ${deleted.deletedCount ?? 0} old log(s) in blocks ${fromBlock} -> ${toBlock}`,
  );
}

async function storeLogs(contractAddress, logs) {
  if (logs.length === 0) {
    console.log("[fund.indexer] no logs to store");
    return;
  }

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
      args: parsed?.args ? resultToArgsObject(parsed?.name, parsed.args) : undefined,
    };
  });

  await ChainLog.insertMany(docs, { ordered: false });

  console.log(`[fund.indexer] stored ${docs.length} log(s)`);

  for (const doc of docs) {
    console.log(
      `[fund.indexer] -> event=${doc.eventName ?? "unknown"} block=${doc.blockNumber} tx=${doc.transactionHash}`,
    );
  }
}

export async function syncFundLogsOnce() {
  const fund = getFund();
  const { confirmations, reorgBuffer, chunkSize } = readReorgPolicyFromEnv();
  const startBlock = getNumberEnv("FUND_START_BLOCK", 0);

  const contractAddress = await fund.getAddress();
  const contractAddressLower = contractAddress.toLowerCase();

  console.log(`[fund.indexer] contract address: ${contractAddressLower}`);
  console.log(`[fund.indexer] start block: ${startBlock}`);

  const syncState = await getOrInitSyncState({
    contractName: CONTRACT_NAME,
    contractAddress,
    startBlock,
  });

  console.log(
    `[fund.indexer] current sync state lastProcessedBlock=${syncState.lastProcessedBlock}`,
  );

  const latest = await provider.getBlockNumber();

  console.log(`[fund.indexer] latest block on chain: ${latest}`);

  const plan = planReorgSafeSync({
    latestBlock: latest,
    confirmations,
    startBlock,
    lastProcessedBlock: syncState.lastProcessedBlock,
    reorgBuffer,
  });

  console.log("[fund.indexer] sync plan:", plan);

  const target = plan.targetBlock;

  if (!plan.shouldSync) {
    console.log("[fund.indexer] nothing to sync");
    return { latest, target, processedTo: syncState.lastProcessedBlock };
  }

  const from = plan.fromBlock;

  await markSyncing(CONTRACT_NAME);
  console.log(`[fund.indexer] syncing from ${from} to ${target}`);

  let currentFrom = from;
  while (currentFrom <= target) {
    const currentTo = Math.min(target, currentFrom + chunkSize - 1);

    console.log(
      `[fund.indexer] fetching logs from blocks ${currentFrom} -> ${currentTo}`,
    );

    await deleteLogsInRange(contractAddressLower, currentFrom, currentTo);

    const logs = await provider.getLogs({
      address: contractAddressLower,
      fromBlock: currentFrom,
      toBlock: currentTo,
    });

    console.log(
      `[fund.indexer] provider returned ${logs.length} log(s) for ${currentFrom} -> ${currentTo}`,
    );

    await storeLogs(contractAddressLower, logs);

    await updateProgress({
      contractName: CONTRACT_NAME,
      contractAddress,
      lastProcessedBlock: currentTo,
      status: "syncing",
    });

    console.log(`[fund.indexer] updated progress to block ${currentTo}`);

    currentFrom = currentTo + 1;
  }

  await markSynced(CONTRACT_NAME);
  console.log("[fund.indexer] sync finished");

  return { latest, target, processedTo: target };
}

export async function runFundIndexerLoop() {
  const intervalMs = getNumberEnv("CHAIN_SYNC_INTERVAL_MS", 10_000);

  while (true) {
    try {
      console.log("[fund.indexer] loop tick");
      await syncFundLogsOnce();
    } catch (err) {
      await markError(CONTRACT_NAME, err);
      console.error("[fund.indexer] error:", err);
      console.error(err?.stack);
    }

    console.log(`[fund.indexer] sleeping ${intervalMs}ms`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}