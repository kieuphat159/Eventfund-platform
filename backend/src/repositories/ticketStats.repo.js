import { TicketStats as DefaultTicketStats, TicketEvent as DefaultTicketEvent } from '../models/index.js';

function safeBigInt(value) {
  if (value === undefined || value === null || value === "") return 0n;
  try { return BigInt(value); } catch { return 0n; }
}

/**
 * Rebuild stats cho một hoặc nhiều eventId
 */
export async function rebuildForEventIds(contractAddressLower, eventIds, models = {}) {
  const TicketStats = models.TicketStats || DefaultTicketStats;
  const TicketEvent = models.TicketEvent || DefaultTicketEvent;
  const uniqueEventIds = [...new Set(eventIds.filter(Boolean))];

  if (uniqueEventIds.length === 0) return;

  for (const eventId of uniqueEventIds) {
    // Logic rebuild stats (giữ nguyên từ processor cũ)
    const mintedDocs = await TicketEvent.find({   // tạm dùng TicketEvent, sau có thể inject
      contractAddress: contractAddressLower,
      eventId,
      eventName: "TicketMintedBatch",
    }).select({ ticketIds: 1 }).lean();

    const totalMinted = mintedDocs.reduce(
      (sum, d) => sum + (Array.isArray(d.ticketIds) ? d.ticketIds.length : 0),
      0
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
    }).select({ priceWei: 1 }).lean();

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
      { upsert: true }
    );
  }
}

export default { rebuildForEventIds };
