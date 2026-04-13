import { ChainLog as DefaultChainLog } from '../models/index.js';

/**
 * Find ChainLog with flexible query (dùng chung cho tất cả processor)
 * @param {Object} query - MongoDB query
 * @param {Object} options - sort, limit, lean...
 * @param {Object} models - Injected models (optional)
 */
export async function findLogs(query = {}, options = {}, models = {}) {
  const ChainLog = models.ChainLog || DefaultChainLog;

  let q = ChainLog.find(query);

  if (options.sort) q = q.sort(options.sort);
  if (options.limit) q = q.limit(options.limit);
  if (options.lean !== false) q = q.lean();

  return await q;
}

/**
 * Upsert single ChainLog (dùng khi cần idempotent insert log)
 */
export async function upsertLog(logData, models = {}) {
  const ChainLog = models.ChainLog || DefaultChainLog;

  return await ChainLog.findOneAndUpdate(
    {
      contractAddress: logData.contractAddress,
      transactionHash: logData.transactionHash,
      logIndex: logData.logIndex,
    },
    logData,
    { upsert: true, new: true, runValidators: true }
  );
}

export default { findLogs, upsertLog };
