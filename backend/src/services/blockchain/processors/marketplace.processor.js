import { ChainLog } from "../../../models/ChainLog.js";
import Listing from "../../../models/Listing.model.js";
import Ticket from "../../../models/Ticket.model.js";
import Event from "../../../models/Event.model.js";

import { provider } from "../core/provider.js";
import { getMarketplace } from "../core/contracts/index.js";
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

const CONTRACT_NAME = "Marketplace";
const PROCESSOR_NAME = "MarketplaceProcessor";

// --- Helpers chuẩn hóa dữ liệu ---
const toStringId = (v) =>
  v === undefined || v === null ? undefined : String(v);
const lowerAddress = (v) => (v ? String(v).toLowerCase() : undefined);

/**
 * Tìm ID tham chiếu (ObjectId) từ chuỗi TokenId hoặc ContractEventId
 */
async function resolveRefs(tokenId, contractEventId) {
  const [ticket, event] = await Promise.all([
    Ticket.findOne({ tokenId: toStringId(tokenId) })
      .select("_id")
      .lean(),
    Event.findOne({ contractEventId: toStringId(contractEventId) })
      .select("_id")
      .lean(),
  ]);
  return { ticketId: ticket?._id, eventId: event?._id };
}

/**
 * Xử lý logic nghiệp vụ cho từng loại Event
 */
async function processMarketplaceLog(log) {
  const { eventName, args, transactionHash, blockNumber } = log;
  const txHash = transactionHash.toLowerCase();
  const tokenId = toStringId(args.tokenId);

  switch (eventName) {
    case "ListingCreated": {
      const { ticketId, eventId } = await resolveRefs(tokenId, args.eventId);

      // 1. Cập nhật hoặc tạo mới Listing
      await Listing.updateOne(
        { tokenId, status: "active" }, // Đảm bảo mỗi token chỉ có 1 listing active
        {
          $set: {
            ticketId,
            eventId,
            tokenId,
            seller: lowerAddress(args.seller),
            price: Number(args.price),
            maxPrice: args.maxPrice ? Number(args.maxPrice) : undefined,
            status: "active",
            listedAt: new Date(),
            txHash: txHash,
          },
        },
        { upsert: true },
      );

      // 2. Đánh dấu Ticket là đang được rao bán
      await Ticket.updateOne({ tokenId }, { $set: { isListed: true } });
      break;
    }

    case "ListingSold": {
      const price = Number(args.price);
      const buyer = lowerAddress(args.buyer);
      const seller = lowerAddress(args.seller);

      // 1. Cập nhật trạng thái Listing sang 'sold'
      await Listing.updateOne(
        { tokenId, status: "active" },
        {
          $set: {
            status: "sold",
            soldTo: buyer,
            soldAt: new Date(),
            soldTxHash: txHash,
          },
        },
      );

      // 2. Cập nhật Ticket: Đổi chủ + Thêm lịch sử + Tắt cờ isListed
      await Ticket.updateOne(
        { tokenId },
        {
          $set: {
            currentOwner: buyer,
            isListed: false,
            status: "sold",
          },
          $push: {
            transferHistory: {
              from: seller,
              to: buyer,
              txHash: txHash,
              timestamp: new Date(),
              price: price,
              type: "resale",
            },
          },
        },
      );
      break;
    }

    case "ListingCancelled": {
      // 1. Hủy Listing
      await Listing.updateOne(
        { tokenId, status: "active" },
        { $set: { status: "cancelled" } },
      );

      // 2. Gỡ cờ niêm yết trên Ticket
      await Ticket.updateOne({ tokenId }, { $set: { isListed: false } });
      break;
    }
  }
}

/**
 * Xóa dữ liệu phái sinh trong Range Block (Dùng khi Reorg)
 */
async function cleanupMarketplaceRange(fromBlock, toBlock) {
  // Tìm các txHash trong ChainLog của range này để revert trạng thái
  const logs = await ChainLog.find({
    contractName: CONTRACT_NAME,
    blockNumber: { $gte: fromBlock, $lte: toBlock },
  })
    .select("transactionHash args eventName")
    .lean();

  for (const log of logs) {
    const tokenId = toStringId(log.args?.tokenId);
    if (!tokenId) continue;

    if (log.eventName === "ListingCreated") {
      await Listing.deleteOne({ txHash: log.transactionHash.toLowerCase() });
      await Ticket.updateOne({ tokenId }, { $set: { isListed: false } });
    }
    // Các trường hợp Sold/Cancelled khi Reorg thường sẽ được ghi đè
    // khi Processor chạy lại (Re-play) nhờ logic findOneAndUpdate.
  }
}

export async function processMarketplaceLogsOnce() {
  const marketplace = getMarketplace();
  const { confirmations, reorgBuffer, chunkSize } = readReorgPolicyFromEnv();
  const startBlock = getNumberEnv("MARKETPLACE_START_BLOCK", 0);

  const contractAddress = (await marketplace.getAddress()).toLowerCase();
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

  if (!plan.shouldSync) return { latest, target: plan.targetBlock };

  await markSyncing(PROCESSOR_NAME);

  let currentFrom = plan.fromBlock;
  const target = plan.targetBlock;

  while (currentFrom <= target) {
    const currentTo = Math.min(target, currentFrom + chunkSize - 1);

    // Xử lý Reorg: Cleanup trước khi ghi đè dữ liệu mới
    await cleanupMarketplaceRange(currentFrom, currentTo);

    const logs = await ChainLog.find({
      contractName: CONTRACT_NAME,
      contractAddress,
      blockNumber: { $gte: currentFrom, $lte: currentTo },
    })
      .sort({ blockNumber: 1, transactionIndex: 1, logIndex: 1 })
      .lean();

    for (const log of logs) {
      await processMarketplaceLog(log);
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
  return { latest, target };
}

export async function runMarketplaceProcessorLoop() {
  const intervalMs = getNumberEnv("CHAIN_PROCESS_INTERVAL_MS", 10000);
  while (true) {
    try {
      await processMarketplaceLogsOnce();
    } catch (err) {
      await markError(PROCESSOR_NAME, err);
      console.error("Marketplace processor error:", err);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
