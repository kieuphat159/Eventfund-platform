import { ChainLog } from "../../../models/ChainLog.js";
import { TicketEvent } from "../../../models/TicketEvent.model.js";
import { TicketStats } from "../../../models/TicketStats.model.js";

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

const CONTRACT_NAME = "Ticket";
const PROCESSOR_NAME = "TicketProcessor";

function toStringId(value) {
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? value : String(value);
}

function lowerAddress(value) {
  if (!value) return undefined;
  return String(value).toLowerCase();
}

function safeBigInt(value) {
  if (value === undefined || value === null || value === "") return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function toDateFromUnix(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return new Date(n * 1000);
}

/**
 * Hỗ trợ đọc arg theo cả 2 kiểu:
 * - args.eventId
 * - args["1"]
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
    /**
     * emit TicketMintedBatch(to, eventId, ticketIds, price, ticketType)
     * named:
     * - to
     * - eventId
     * - ticketIds
     * - price
     * - ticketType
     *
     * positional:
     * 0: to
     * 1: eventId
     * 2: ticketIds
     * 3: price
     * 4: ticketType
     */
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

    /**
     * emit TicketPurchased(tokenId, eventId, buyer, price)
     * named:
     * - tokenId
     * - eventId
     * - buyer
     * - price
     *
     * positional:
     * 0: tokenId
     * 1: eventId
     * 2: buyer
     * 3: price
     */
    case "TicketPurchased": {
      return {
        ...base,
        eventId: toStringId(getArg(args, "eventId", 1)),
        tokenId: toStringId(getArg(args, "tokenId", 0)),
        buyer: lowerAddress(getArg(args, "buyer", 2)),
        priceWei: toStringId(getArg(args, "price", 3)),
      };
    }

    /**
     * emit TicketUsed(tokenId, eventId, owner, verifier, usedAt)
     * positional:
     * 0: tokenId
     * 1: eventId
     * 2: owner
     * 3: verifier
     * 4: usedAt
     */
    case "TicketUsed": {
      const usedAtRaw = getArg(args, "usedAt", 4);

      return {
        ...base,
        eventId: toStringId(getArg(args, "eventId", 1)),
        tokenId: toStringId(getArg(args, "tokenId", 0)),
        owner: lowerAddress(getArg(args, "owner", 2)),
        verifier: lowerAddress(getArg(args, "verifier", 3)),
        usedAt: toStringId(usedAtRaw),
        usedAtDate: toDateFromUnix(usedAtRaw),
      };
    }

    /**
     * emit TicketExpired(tokenId, eventId)
     * positional:
     * 0: tokenId
     * 1: eventId
     */
    case "TicketExpired": {
      return {
        ...base,
        eventId: toStringId(getArg(args, "eventId", 1)),
        tokenId: toStringId(getArg(args, "tokenId", 0)),
      };
    }

    /**
     * emit TicketRefunded(tokenId, eventId, owner, refundAmount)
     * positional:
     * 0: tokenId
     * 1: eventId
     * 2: owner
     * 3: refundAmount
     */
    case "TicketRefunded": {
      return {
        ...base,
        eventId: toStringId(getArg(args, "eventId", 1)),
        tokenId: toStringId(getArg(args, "tokenId", 0)),
        owner: lowerAddress(getArg(args, "owner", 2)),
        refundAmountWei: toStringId(getArg(args, "refundAmount", 3)),
      };
    }

    /**
     * emit FundContractSet(fund)
     * positional:
     * 0: fund
     */
    case "FundContractSet": {
      return {
        ...base,
        to: lowerAddress(getArg(args, "fund", 0)),
      };
    }

    /**
     * ERC721 Transfer(from, to, tokenId)
     * positional:
     * 0: from
     * 1: to
     * 2: tokenId
     */
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

async function deleteDerivedEventsInRange(
  contractAddressLower,
  fromBlock,
  toBlock,
) {
  await TicketEvent.deleteMany({
    contractAddress: contractAddressLower,
    blockNumber: { $gte: fromBlock, $lte: toBlock },
  });
}

async function rebuildStatsForEventIds(contractAddressLower, eventIds) {
  const uniqueEventIds = Array.from(
    new Set(eventIds.map(toStringId).filter(Boolean)),
  );

  if (uniqueEventIds.length === 0) return;

  for (const eventId of uniqueEventIds) {
    const mintedDocs = await TicketEvent.find({
      contractAddress: contractAddressLower,
      eventId,
      eventName: "TicketMintedBatch",
    })
      .select({ ticketIds: 1 })
      .lean();

    const totalMinted = mintedDocs.reduce(
      (sum, d) => sum + (Array.isArray(d.ticketIds) ? d.ticketIds.length : 0),
      0,
    );

    const totalSold = await TicketEvent.countDocuments({
      contractAddress: contractAddressLower,
      eventId,
      eventName: "TicketPurchased",
    });

    const totalUsed = await TicketEvent.countDocuments({
      contractAddress: contractAddressLower,
      eventId,
      eventName: "TicketUsed",
    });

    const totalExpired = await TicketEvent.countDocuments({
      contractAddress: contractAddressLower,
      eventId,
      eventName: "TicketExpired",
    });

    const totalRefunded = await TicketEvent.countDocuments({
      contractAddress: contractAddressLower,
      eventId,
      eventName: "TicketRefunded",
    });

    const purchasedDocs = await TicketEvent.find({
      contractAddress: contractAddressLower,
      eventId,
      eventName: "TicketPurchased",
    })
      .select({ priceWei: 1 })
      .lean();

    const totalRevenueWei = purchasedDocs
      .reduce((sum, d) => sum + safeBigInt(d.priceWei), 0n)
      .toString();

    await TicketStats.updateOne(
      { contractAddress: contractAddressLower, eventId },
      {
        $set: {
          totalMinted,
          totalSold,
          totalUsed,
          totalExpired,
          totalRefunded,
          totalRevenueWei,
          lastRebuiltAt: new Date(),
        },
      },
      { upsert: true },
    );
  }
}

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

    await deleteDerivedEventsInRange(
      contractAddressLower,
      currentFrom,
      currentTo,
    );

    const logs = await ChainLog.find({
      contractName: CONTRACT_NAME,
      contractAddress: contractAddressLower,
      blockNumber: { $gte: currentFrom, $lte: currentTo },
      eventName: { $ne: null },
    })
      .sort({ blockNumber: 1, transactionIndex: 1, logIndex: 1 })
      .lean();

    const docs = logs.map((l) =>
      mapChainLogToTicketEventDoc(l, contractAddressLower),
    );

    if (docs.length > 0) {
      await TicketEvent.insertMany(docs, { ordered: false });

      const affectedEventIds = docs
        .map((d) => d.eventId)
        .filter(Boolean);

      await rebuildStatsForEventIds(contractAddressLower, affectedEventIds);
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

  return { latest, target, processedTo: target };
}

export async function runTicketProcessorLoop() {
  const intervalMs = getNumberEnv(
    "CHAIN_PROCESS_INTERVAL_MS",
    getNumberEnv("CHAIN_SYNC_INTERVAL_MS", 10_000),
  );

  // eslint-disable-next-line no-constant-condition
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