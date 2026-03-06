import { initFundListeners, stopFundListeners } from "./fundListeners.js";
import { initTicketListeners, stopTicketListeners } from "./ticketListeners.js";
import {
  initMarketplaceListeners,
  stopMarketplaceListeners,
} from "./marketplaceListeners.js";

import { processFundEvent } from "../processors/fund.processor.js";
import { processTicketEvent } from "../processors/ticket.processor.js";
import { processMarketplaceEvent } from "../processors/marketplace.processor.js";
import { blockchainEventQueue } from "../processors/eventQueue.js";

/**
 * Bọc processor bằng queue để:
 * - listener chỉ việc đẩy event vào queue
 * - processor xử lý tuần tự
 * - giảm khả năng race condition khi nhiều event tới cùng lúc
 */
function queueProcessor(processor, processorName) {
  return async (eventName, payload) => {
    return blockchainEventQueue.enqueue(async () => {
      try {
        return await processor(eventName, payload);
      } catch (error) {
        console.error(`[ListenerIndex] ${processorName} failed for ${eventName}:`, error);
        throw error;
      }
    });
  };
}

/**
 * Khởi tạo toàn bộ listeners
 *
 * Flow:
 * - Fund listener  -> queue -> fund processor
 * - Ticket listener -> queue -> ticket processor
 * - Marketplace listener -> queue -> marketplace processor
 */
export async function initAllListeners() {
  const queuedFundProcessor = queueProcessor(processFundEvent, "FundProcessor");
  const queuedTicketProcessor = queueProcessor(processTicketEvent, "TicketProcessor");
  const queuedMarketplaceProcessor = queueProcessor(
    processMarketplaceEvent,
    "MarketplaceProcessor"
  );

  await initFundListeners(queuedFundProcessor);
  await initTicketListeners(queuedTicketProcessor);
  await initMarketplaceListeners(queuedMarketplaceProcessor);

  console.log("[Listener] All blockchain listeners initialized");
}

/**
 * Dừng toàn bộ listeners
 *
 * Dùng khi:
 * - restart app
 * - shutdown graceful
 * - hot reload
 */
export async function stopAllListeners() {
  await stopFundListeners();
  await stopTicketListeners();
  await stopMarketplaceListeners();

  blockchainEventQueue.stop();

  console.log("[Listener] All blockchain listeners stopped");
}

/**
 * Debug nhanh trạng thái queue
 */
export function getListenerSystemStats() {
  return {
    queue: blockchainEventQueue.stats(),
  };
}