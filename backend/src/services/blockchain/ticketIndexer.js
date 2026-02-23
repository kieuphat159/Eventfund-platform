import { provider } from "./connection.js";
import { getTicket } from "./contracts.js";
import { BlockchainSyncState } from "../../models/BlockchainSyncState.js";
import { ChainLog } from "../../models/ChainLog.js";

const CONTRACT_NAME = "Ticket";

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

  // ethers v6 Result is array-like + has named keys.
  const out = {};
  for (const [k, v] of Object.entries(result)) {
    // Skip numeric keys; we prefer named args when present.
    if (/^\d+$/.test(k)) continue;
    out[k] = sanitizeForMongo(v);
  }

  // If there were no named keys, fall back to numeric indices.
  if (Object.keys(out).length === 0) {
    for (let i = 0; i < result.length; i += 1) {
      out[String(i)] = sanitizeForMongo(result[i]);
    }
  }

  return out;
}

function getNumberEnv(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number env ${name}=${raw}`);
  }
  return parsed;
}

async function getOrInitSyncState(startBlock) {
  const ticket = getTicket();
  const contractAddress = await ticket.getAddress();

  const existing = await BlockchainSyncState.findOne({
    contractName: CONTRACT_NAME,
  });

  if (existing) return existing;

  return BlockchainSyncState.create({
    contractName: CONTRACT_NAME,
    contractAddress,
    lastProcessedBlock: startBlock,
    status: "synced",
  });
}

async function deleteLogsInRange(contractAddress, fromBlock, toBlock) {
  await ChainLog.deleteMany({
    contractAddress: contractAddress.toLowerCase(),
    blockNumber: { $gte: fromBlock, $lte: toBlock },
  });
}

async function storeLogs(contractAddress, logs) {
  if (logs.length === 0) return;

  const ticket = getTicket();

  const docs = logs.map((log) => {
    let parsed;
    try {
      parsed = ticket.interface.parseLog({ topics: log.topics, data: log.data });
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

  // Insert with ordered:false so duplicates (rare) don't abort the batch.
  await ChainLog.insertMany(docs, { ordered: false });
}

export async function syncTicketLogsOnce() {
  const ticket = getTicket();
  const confirmations = getNumberEnv("CHAIN_CONFIRMATIONS", 12);
  const reorgBuffer = getNumberEnv("REORG_BUFFER_BLOCKS", 12);
  const chunkSize = getNumberEnv("CHAIN_LOG_CHUNK_SIZE", 2000);
  const startBlock = getNumberEnv("TICKET_START_BLOCK", 0);

  const syncState = await getOrInitSyncState(startBlock);
  const contractAddress = (await ticket.getAddress()).toLowerCase();

  const latest = await provider.getBlockNumber();
  const target = Math.max(0, latest - confirmations);

  if (target <= 0) return { latest, target, processedTo: syncState.lastProcessedBlock };

  const from = Math.max(startBlock, Math.max(0, syncState.lastProcessedBlock - reorgBuffer + 1));
  if (from > target) {
    return { latest, target, processedTo: syncState.lastProcessedBlock };
  }

  await BlockchainSyncState.updateOne(
    { contractName: CONTRACT_NAME },
    { $set: { status: "syncing", errorMessage: null } }
  );

  let currentFrom = from;
  while (currentFrom <= target) {
    const currentTo = Math.min(target, currentFrom + chunkSize - 1);

    // Reorg-handling strategy: for the rescan range, wipe then re-insert logs.
    await deleteLogsInRange(contractAddress, currentFrom, currentTo);

    const logs = await provider.getLogs({
      address: contractAddress,
      fromBlock: currentFrom,
      toBlock: currentTo,
    });

    await storeLogs(contractAddress, logs);

    await BlockchainSyncState.updateOne(
      { contractName: CONTRACT_NAME },
      {
        $set: {
          contractAddress,
          lastProcessedBlock: currentTo,
          lastSyncAt: new Date(),
          status: "syncing",
        },
      }
    );

    currentFrom = currentTo + 1;
  }

  await BlockchainSyncState.updateOne(
    { contractName: CONTRACT_NAME },
    { $set: { status: "synced", lastSyncAt: new Date() } }
  );

  return { latest, target, processedTo: target };
}

export async function runTicketIndexerLoop() {
  const intervalMs = getNumberEnv("CHAIN_SYNC_INTERVAL_MS", 10_000);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await syncTicketLogsOnce();
    } catch (err) {
      await BlockchainSyncState.updateOne(
        { contractName: CONTRACT_NAME },
        {
          $set: {
            status: "error",
            errorMessage: err instanceof Error ? err.message : String(err),
            lastSyncAt: new Date(),
          },
        },
        { upsert: true }
      );

      // Keep process alive; next iteration may recover.
      // eslint-disable-next-line no-console
      console.error("Ticket indexer error:", err);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
