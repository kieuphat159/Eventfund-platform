import { provider } from "../core/provider.js";
import { getTicket } from "../core/contracts/index.js";
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
import ticketEventRepo from "../../../repositories/ticketEvent.repo.js";
import ticketStatsRepo from "../../../repositories/ticketStats.repo.js";
import chainLogRepo from "../../../repositories/chainLog.repo.js";
import * as ticketRepo from "../../../repositories/ticket.repo.js";
import * as eventRepo from "../../../repositories/event.repo.js";

const CONTRACT_NAME = "Ticket";
const PROCESSOR_NAME = "TicketProcessor";

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

function mapChainTicketType(value) {
  const normalized = Number(value);
  if (normalized === 1) return "vip";
  if (normalized === 2) return "early_bird";
  if (normalized === 3) return "etc";
  return "standard";
}

const FUND_CONTRACT_ADDRESS = lowerAddress(process.env.FUND_ADDRESS);

/**
 * Hỗ trợ đọc arg theo cả 2 kiểu: named hoặc positional
 */
function getArg(args, name, index) {
  if (!args) return undefined;
  if (args[name] !== undefined && args[name] !== null) return args[name];
  if (index !== undefined && args[String(index)] !== undefined && args[String(index)] !== null) {
    return args[String(index)];
  }
  return undefined;
}

function mapChainLogToTicketEventDoc(chainLog, contractAddressLower) {
  const eventName = chainLog.eventName || "Unknown";
  const args = chainLog.args || {};

  const base = {
    contractAddress: contractAddressLower,
    blockNumber: chainLog.blockNumber,
    blockHash: chainLog.blockHash,
    transactionHash: chainLog.transactionHash,
    transactionIndex: chainLog.transactionIndex,
    logIndex: chainLog.logIndex,
    eventName,
    rawArgs: args,
  };

  switch (eventName) {
    case "TicketMintedBatch": {
      const eventId = toStringId(getArg(args, "eventId", 1));
      const ticketIdsRaw = getArg(args, "ticketIds", 2);
      const ticketIds = Array.isArray(ticketIdsRaw)
        ? ticketIdsRaw.map(toStringId).filter(Boolean)
        : undefined;

      return {
        ...base,
        eventId,
        organizer: lowerAddress(getArg(args, "to", 0)),
        ticketIds,
        priceWei: toStringId(getArg(args, "price", 3)),
        ticketType: getArg(args, "ticketType", 4) !== undefined
          ? Number(getArg(args, "ticketType", 4))
          : undefined,
      };
    }

    case "TicketPurchased": {
      return {
        ...base,
        eventId: toStringId(getArg(args, "eventId", 1)),
        tokenId: toStringId(getArg(args, "tokenId", 0)),
        buyer: lowerAddress(getArg(args, "buyer", 2)),
        priceWei: toStringId(getArg(args, "price", 3)),
      };
    }

    case "TicketUsed": {
      const usedAtRaw = getArg(args, "usedAt", 4);
      return {
        ...base,
        eventId: toStringId(getArg(args, "eventId", 1)),
        tokenId: toStringId(getArg(args, "tokenId", 0)),
        owner: lowerAddress(getArg(args, "owner", 2)),
        verifier: lowerAddress(getArg(args, "verifier", 3)),
        usedAt: toStringId(usedAtRaw),
        // usedAtDate removed: not in TicketEvent schema; use usedAt (String) only
      };
    }

    case "TicketExpired": {
      return {
        ...base,
        eventId: toStringId(getArg(args, "eventId", 1)),
        tokenId: toStringId(getArg(args, "tokenId", 0)),
      };
    }

    case "TicketRefunded": {
      return {
        ...base,
        eventId: toStringId(getArg(args, "eventId", 1)),
        tokenId: toStringId(getArg(args, "tokenId", 0)),
        owner: lowerAddress(getArg(args, "owner", 2)),
        refundAmountWei: toStringId(getArg(args, "refundAmount", 3)),
      };
    }

    case "FundContractSet": {
      return {
        ...base,
        to: lowerAddress(getArg(args, "fund", 0)),
      };
    }

    case "Transfer": {
      return {
        ...base,
        tokenId: toStringId(getArg(args, "tokenId", 2)),
        from: lowerAddress(getArg(args, "from", 0)),
        to: lowerAddress(getArg(args, "to", 1)),
      };
    }

    default:
      return base;
  }
}

async function syncMintedTicketsFromLogs(logs) {
  const mintedLogs = (logs || []).filter((log) => log.eventName === "TicketMintedBatch");
  if (mintedLogs.length === 0) return;

  const blockTimestampCache = new Map();

  for (const log of mintedLogs) {
    const args = log.args || {};
    const contractEventId = toStringId(getArg(args, "eventId", 1));
    const tokenIdsRaw = getArg(args, "ticketIds", 2);

    if (!contractEventId || !Array.isArray(tokenIdsRaw) || tokenIdsRaw.length === 0) {
      continue;
    }

    const eventDoc = await eventRepo.findByContractEventId(
      contractEventId,
      FUND_CONTRACT_ADDRESS,
    );
    if (!eventDoc?._id) {
      continue;
    }

    const owner = lowerAddress(getArg(args, "to", 0));
    const originalPrice = toStringId(getArg(args, "price", 3)) || "0";
    const ticketType = mapChainTicketType(getArg(args, "ticketType", 4));
    const txHash = lowerAddress(log.transactionHash);

    let mintedAt;
    const cacheKey = Number(log.blockNumber);
    if (Number.isFinite(cacheKey)) {
      if (!blockTimestampCache.has(cacheKey)) {
        const block = await provider.getBlock(cacheKey);
        blockTimestampCache.set(
          cacheKey,
          block?.timestamp ? new Date(Number(block.timestamp) * 1000) : undefined,
        );
      }
      mintedAt = blockTimestampCache.get(cacheKey);
    }

    for (const tokenIdRaw of tokenIdsRaw) {
      const tokenId = toStringId(tokenIdRaw);
      if (!tokenId) continue;

      await ticketRepo.upsertMintedFromChain({
        tokenId,
        eventId: eventDoc._id,
        currentOwner: owner,
        originalPrice,
        ticketType,
        mintedAt,
        mintTxHash: txHash,
      });
    }
  }
}

// -------------------------
// MAIN PROCESSOR
// -------------------------
export async function processTicketLogsOnce() {
  const ticket = getTicket();
  const { confirmations, reorgBuffer, chunkSize } = readReorgPolicyFromEnv();

  const startBlock = getNumberEnv(
    "TICKET_PROCESSOR_START_BLOCK",
    getNumberEnv("TICKET_START_BLOCK", 0),
  );

  const contractAddress = await ticket.getAddress();
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
    return { latest, target, processedTo: syncState.lastProcessedBlock };
  }

  const from = plan.fromBlock;

  await markSyncing(PROCESSOR_NAME);

  let currentFrom = from;
  while (currentFrom <= target) {
    const currentTo = Math.min(target, currentFrom + chunkSize - 1);

    const logs = await chainLogRepo.findLogs(
      {
        contractName: CONTRACT_NAME,
        contractAddress: contractAddressLower,
        blockNumber: { $gte: currentFrom, $lte: currentTo },
        eventName: { $ne: null },
      },
      { sort: { blockNumber: 1, transactionIndex: 1, logIndex: 1 } }
    );

    const preDeleteEventIds = await ticketEventRepo.findEventIdsInRange(
      contractAddressLower,
      currentFrom,
      currentTo
    );

    // Reorg-safe: xoa TicketEvent trong range truoc, insert lai tu ChainLog canonical
    // Neu block bi reorg, indexer da xoa ChainLog do → insertMany chi insert canonical
    await ticketEventRepo.deleteInRange(contractAddressLower, currentFrom, currentTo);

    const docs = logs.map(l => mapChainLogToTicketEventDoc(l, contractAddressLower));
    const postInsertEventIds = [...new Set(docs.map(d => d.eventId).filter(Boolean))];

    if (docs.length > 0) {
      await ticketEventRepo.insertMany(docs);
      await syncMintedTicketsFromLogs(logs);
    }

    const affectedEventIds = [...new Set([...preDeleteEventIds, ...postInsertEventIds])];
    await ticketStatsRepo.rebuildForEventIds(contractAddressLower, affectedEventIds);

    await updateProgress({
      contractName: PROCESSOR_NAME,
      contractAddress,
      lastProcessedBlock: currentTo,
      status: "syncing",
    });

    currentFrom = currentTo + 1;
  }

  await markSynced(PROCESSOR_NAME);

  return { latest, target, processedTo: target };
}

export async function runTicketProcessorLoop() {
  const intervalMs = getNumberEnv(
    "CHAIN_PROCESS_INTERVAL_MS",
    getNumberEnv("CHAIN_SYNC_INTERVAL_MS", 10_000),
  );

  while (true) {
    try {
      await processTicketLogsOnce();
    } catch (err) {
      await markError(PROCESSOR_NAME, err);
      console.error("Ticket processor error:", err);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
