import { TicketEvent as DefaultTicketEvent } from '../models/index.js';

/**
 * Upsert TicketEvent (idempotent)
 * Dùng khi mapChainLogToTicketEventDoc
 */
export async function upsertTicketEvent(eventData, models = {}) {
  const TicketEvent = models.TicketEvent || DefaultTicketEvent;

  // Destructure _id out to avoid overwriting it in $set
  const { _id, ...fields } = eventData;

  return await TicketEvent.findOneAndUpdate(
    {
      contractAddress: eventData.contractAddress,
      transactionHash: eventData.transactionHash,
      logIndex: eventData.logIndex,
    },
    { $set: fields },
    {
      upsert: true,
      new: true,
      runValidators: true,
      lean: true,
    }
  );
}

/**
 * Delete TicketEvent trong range (nếu vẫn cần dùng trong một số trường hợp)
 * Nhưng sau refactor idempotent, hàm này ít được dùng hơn
 */
export async function deleteInRange(contractAddressLower, fromBlock, toBlock, models = {}) {
  const TicketEvent = models.TicketEvent || DefaultTicketEvent;

  return await TicketEvent.deleteMany({
    contractAddress: contractAddressLower,
    blockNumber: { $gte: fromBlock, $lte: toBlock },
  });
}

/**
 * Insert nhiều TicketEvent cùng lúc (dùng sau deleteInRange)
 */
export async function insertMany(docs, models = {}) {
  const TicketEvent = models.TicketEvent || DefaultTicketEvent;
  if (!docs || docs.length === 0) return;
  await TicketEvent.insertMany(docs, { ordered: false });
}

export default { upsertTicketEvent, deleteInRange, insertMany };
