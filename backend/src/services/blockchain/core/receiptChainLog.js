import { ethers } from "ethers";
import { ChainLog } from "../../../models/ChainLog.js";

function sanitizeForMongo(value) {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return ethers.hexlify(value);
  if (Array.isArray(value)) return value.map(sanitizeForMongo);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (Number.isNaN(Number(k))) {
        out[k] = sanitizeForMongo(v);
      }
    }
    return out;
  }
  return value;
}

export async function persistLogsFromReceipt({
  receipt,
  contract,
  contractName,
  contractAddress,
}) {
  if (!receipt || !contract || !contractAddress) return 0;

  const addressLower = String(contractAddress).toLowerCase();
  const docs = [];

  for (const log of receipt.logs || []) {
    if (!log?.address || log.address.toLowerCase() !== addressLower) continue;

    let parsed;
    try {
      parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
    } catch {
      parsed = undefined;
    }

    docs.push({
      contractName,
      contractAddress: addressLower,
      blockNumber: log.blockNumber,
      blockHash: log.blockHash,
      transactionHash: log.transactionHash,
      transactionIndex: log.transactionIndex,
      logIndex: log.index,
      topics: log.topics,
      data: log.data,
      eventName: parsed?.name,
      args: parsed?.args ? sanitizeForMongo(parsed.args) : undefined,
    });
  }

  if (docs.length === 0) return 0;

  try {
    await ChainLog.insertMany(docs, { ordered: false });
    return docs.length;
  } catch (error) {
    // Ignore duplicate-key collisions (idempotent key: contractAddress+txHash+logIndex).
    if (error?.code === 11000 || /duplicate key/i.test(String(error?.message || ""))) {
      return docs.length;
    }
    throw error;
  }
}
