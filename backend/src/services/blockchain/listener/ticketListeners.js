import { getTicket } from "../core/contracts/index.js";

// Giữ instance contract ở scope file để:
// 1) chỉ khởi tạo 1 lần
// 2) có thể remove listeners khi cần stop/restart
let ticketContract;

/**
 * Khởi tạo Ticket listener
 *
 * @param {Function} processTicketEvent
 * Hàm này do processor truyền vào để xử lý dữ liệu event.
 * Listener chỉ có nhiệm vụ NGHE event và gom data.
 */
export async function initTicketListeners(processTicketEvent) {
  try {
    // Lấy contract instance từ core/contracts/index.js
    // => dùng chung provider + address + abi đã cấu hình sẵn
    ticketContract = getTicket();

    // In ra địa chỉ contract để dễ debug
    const address = await ticketContract.getAddress();
    console.log(`[TicketListener] Listening on contract: ${address}`);

    // Đăng ký toàn bộ event listeners
    setupTicketEventListeners(processTicketEvent);

    console.log("[TicketListener] Initialized successfully");
  } catch (error) {
    console.error("[TicketListener] Init failed:", error);
    throw error;
  }
}

/**
 * Hàm đăng ký listeners cho từng event của Ticket.sol
 */
function setupTicketEventListeners(processTicketEvent) {
  if (!ticketContract) {
    throw new Error("Ticket contract is not initialized");
  }

  /**
   * Helper lấy metadata từ object event của ethers v6.
   *
   * Vì tuỳ version/provider, blockNumber / txHash có thể nằm ở:
   * - event.log.blockNumber
   * - event.log.transactionHash
   * - event.log.index
   *
   * Nên gom lại 1 chỗ cho sạch code.
   */
  function getEventMeta(event) {
    return {
      blockNumber: event?.log?.blockNumber,
      transactionHash: event?.log?.transactionHash,
      logIndex: event?.log?.index,
    };
  }

  /**
   * =========================================================
   * 1) FundContractSet(address indexed fund)
   * =========================================================
   *
   * Được emit khi admin gọi setFundContract().
   * Dùng để biết Ticket đã được nối với Fund contract nào.
   */
  ticketContract.on("FundContractSet", async (fund, event) => {
    try {
      const meta = getEventMeta(event);

      await processTicketEvent("FundContractSet", {
        fund,
        ...meta,
      });
    } catch (error) {
      console.error("[TicketListener] FundContractSet error:", error);
    }
  });

  /**
   * =========================================================
   * 2) TicketMintedBatch(...)
   * =========================================================
   *
   * Contract emit:
   * emit TicketMintedBatch(to, eventId, ticketIds, price, ticketType);
   *
   * Ý nghĩa:
   * - organizer/fund mint ra 1 batch ticket cho 1 event
   * - ticketIds là mảng id đã được mint
   */
  ticketContract.on(
    "TicketMintedBatch",
    async (to, eventId, ticketIds, price, ticketType, event) => {
      try {
        const meta = getEventMeta(event);

        await processTicketEvent("TicketMintedBatch", {
          to,
          eventId: eventId.toString(),

          // ticketIds là mảng bigint => convert sang string hết
          ticketIds: Array.isArray(ticketIds)
            ? ticketIds.map((id) => id.toString())
            : [],

          price: price.toString(),
          ticketType: ticketType.toString(),
          ...meta,
        });
      } catch (error) {
        console.error("[TicketListener] TicketMintedBatch error:", error);
      }
    }
  );

  /**
   * =========================================================
   * 3) TicketPurchased(...)
   * =========================================================
   *
   * Contract emit:
   * emit TicketPurchased(tokenId, ticket.eventId, msg.sender, ticket.price);
   *
   * Ý nghĩa:
   * - buyer mua thành công 1 ticket
   * - tokenId: vé nào được mua
   * - eventId: vé thuộc event nào
   * - buyer: người mua
   * - price: giá vé
   */
  ticketContract.on(
    "TicketPurchased",
    async (tokenId, eventId, buyer, price, event) => {
      try {
        const meta = getEventMeta(event);

        await processTicketEvent("TicketPurchased", {
          tokenId: tokenId.toString(),
          eventId: eventId.toString(),
          buyer,
          price: price.toString(),
          ...meta,
        });
      } catch (error) {
        console.error("[TicketListener] TicketPurchased error:", error);
      }
    }
  );

  /**
   * =========================================================
   * 4) TicketRefunded(...)
   * =========================================================
   *
   * Contract emit ở 2 chỗ:
   * - claimRefund(tokenId): emit TicketRefunded(..., ticket.price)
   * - markAsRefunded(tokenId): emit TicketRefunded(..., 0)
   *
   * Ý nghĩa:
   * - ticket được đánh dấu đã refund
   * - amount có thể là:
   *   + giá thật nếu claimRefund
   *   + 0 nếu markAsRefunded
   */
  ticketContract.on(
    "TicketRefunded",
    async (tokenId, eventId, owner, amount, event) => {
      try {
        const meta = getEventMeta(event);

        await processTicketEvent("TicketRefunded", {
          tokenId: tokenId.toString(),
          eventId: eventId.toString(),
          owner,
          amount: amount.toString(),
          ...meta,
        });
      } catch (error) {
        console.error("[TicketListener] TicketRefunded error:", error);
      }
    }
  );

  /**
   * =========================================================
   * 5) TicketRefundClaimed(...)
   * =========================================================
   *
   * Đây là event custom trong Ticket.sol:
   * event TicketRefundClaimed(tokenId, eventId, owner, amount)
   *
   * Ý nghĩa:
   * - owner đã claim refund thành công qua claimRefund()
   * - event này rất hữu ích để backend biết refund thật sự đã được claim
   */
  ticketContract.on(
    "TicketRefundClaimed",
    async (tokenId, eventId, owner, amount, event) => {
      try {
        const meta = getEventMeta(event);

        await processTicketEvent("TicketRefundClaimed", {
          tokenId: tokenId.toString(),
          eventId: eventId.toString(),
          owner,
          amount: amount.toString(),
          ...meta,
        });
      } catch (error) {
        console.error("[TicketListener] TicketRefundClaimed error:", error);
      }
    }
  );

  /**
   * =========================================================
   * 6) TicketUsed(...)
   * =========================================================
   *
   * Contract emit:
   * emit TicketUsed(tokenId, ticket.eventId, ownerOf(tokenId), msg.sender, block.timestamp);
   *
   * Ý nghĩa:
   * - verifier check-in vé
   * - tokenId: vé nào
   * - eventId: thuộc event nào
   * - owner: chủ vé lúc check-in
   * - verifier: người xác minh/check-in
   * - usedAt: timestamp check-in
   */
  ticketContract.on(
    "TicketUsed",
    async (tokenId, eventId, owner, verifier, usedAt, event) => {
      try {
        const meta = getEventMeta(event);

        await processTicketEvent("TicketUsed", {
          tokenId: tokenId.toString(),
          eventId: eventId.toString(),
          owner,
          verifier,
          usedAt: usedAt.toString(),
          ...meta,
        });
      } catch (error) {
        console.error("[TicketListener] TicketUsed error:", error);
      }
    }
  );

  /**
   * =========================================================
   * 7) TicketExpired(...)
   * =========================================================
   *
   * Contract emit:
   * emit TicketExpired(tokenId, ticket.eventId);
   *
   * Ý nghĩa:
   * - ticket đã hết hạn sử dụng
   */
  ticketContract.on("TicketExpired", async (tokenId, eventId, event) => {
    try {
      const meta = getEventMeta(event);

      await processTicketEvent("TicketExpired", {
        tokenId: tokenId.toString(),
        eventId: eventId.toString(),
        ...meta,
      });
    } catch (error) {
      console.error("[TicketListener] TicketExpired error:", error);
    }
  });
}

/**
 * Gỡ toàn bộ listeners của Ticket contract
 *
 * Dùng khi:
 * - restart app
 * - hot reload
 * - muốn tránh bị bind trùng listener
 */
export async function stopTicketListeners() {
  if (ticketContract) {
    ticketContract.removeAllListeners();
    console.log("[TicketListener] All listeners removed");
  }
}

// Export ra nếu nơi khác muốn dùng instance này
export { ticketContract };