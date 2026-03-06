import { getFund } from "../core/contracts/index.js";

// Biến global trong file để giữ instance Fund contract.
// Mục đích:
// - chỉ khởi tạo 1 lần
// - có thể removeAllListeners() khi cần stop
let fundContract;

/**
 * Khởi tạo Fund listener
 *
 * @param {Function} processFundEvent
 * Hàm xử lý event do processor truyền vào.
 *
 * Flow:
 * 1. Lấy contract instance từ getFund()
 * 2. Kiểm tra contract address
 * 3. Đăng ký toàn bộ event listeners
 */
export async function initFundListeners(processFundEvent) {
  try {
    // Lấy instance contract Fund từ file core/contracts/index.js
    // => ở đó đã có sẵn address + abi + provider
    fundContract = getFund();

    // In ra địa chỉ contract để debug
    const address = await fundContract.getAddress();
    console.log(`[FundListener] Listening on contract: ${address}`);

    // Gắn listeners cho toàn bộ event của Fund.sol
    setupFundEventListeners(processFundEvent);

    console.log("[FundListener] Initialized successfully");
  } catch (error) {
    console.error("[FundListener] Init failed:", error);
    throw error;
  }
}

/**
 * Đăng ký listeners cho từng event của Fund.sol
 *
 * Listener chỉ có nhiệm vụ:
 * - nghe event từ blockchain
 * - convert dữ liệu cho dễ dùng
 * - đóng gói payload
 * - chuyển payload sang processor
 *
 * Listener KHÔNG xử lý business logic, KHÔNG lưu DB.
 */
function setupFundEventListeners(processFundEvent) {
  if (!fundContract) {
    throw new Error("Fund contract is not initialized");
  }

  /**
   * Helper lấy metadata từ object event của ethers
   *
   * Vì processor/indexer thường cần:
   * - blockNumber
   * - transactionHash
   * - logIndex
   *
   * để trace transaction và chống duplicate event.
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
   * 1) EventCreated
   * =========================================================
   *
   * Solidity:
   * EventCreated(
   *   eventId,
   *   organizer,
   *   stakeAmount,
   *   minStakeRequired,
   *   fundingGoal,
   *   fundingDeadline,
   *   organizerShareBps,
   *   ticketPrice,
   *   maxTickets,
   *   usedThreshold
   * )
   *
   * Ý nghĩa:
   * - organizer tạo 1 event mới để funding
   * - đây là event đầu tiên đánh dấu event xuất hiện trên chain
   */
  fundContract.on(
    "EventCreated",
    async (
      eventId,
      organizer,
      stakeAmount,
      minStakeRequired,
      fundingGoal,
      fundingDeadline,
      organizerShareBps,
      ticketPrice,
      maxTickets,
      usedThreshold,
      event
    ) => {
      try {
        const meta = getEventMeta(event);

        await processFundEvent("EventCreated", {
          eventId: eventId.toString(),
          organizer,
          stakeAmount: stakeAmount.toString(),
          minStakeRequired: minStakeRequired.toString(),
          fundingGoal: fundingGoal.toString(),
          fundingDeadline: fundingDeadline.toString(),
          organizerShareBps: organizerShareBps.toString(),
          ticketPrice: ticketPrice.toString(),
          maxTickets: maxTickets.toString(),
          usedThreshold: usedThreshold.toString(),
          ...meta,
        });
      } catch (error) {
        console.error("[FundListener] EventCreated error:", error);
      }
    }
  );

  /**
   * =========================================================
   * 2) ContributionMade
   * =========================================================
   *
   * Solidity:
   * ContributionMade(eventId, donator, amount)
   *
   * Ý nghĩa:
   * - có người đóng góp tiền vào event
   * - amount là số ETH/wei đóng góp
   */
  fundContract.on("ContributionMade", async (eventId, donator, amount, event) => {
    try {
      const meta = getEventMeta(event);

      await processFundEvent("ContributionMade", {
        eventId: eventId.toString(),
        donator,
        amount: amount.toString(),
        ...meta,
      });
    } catch (error) {
      console.error("[FundListener] ContributionMade error:", error);
    }
  });

  /**
   * =========================================================
   * 3) SharesIssued
   * =========================================================
   *
   * Solidity:
   * SharesIssued(eventId, donator, sharesMinted)
   *
   * Ý nghĩa:
   * - sau khi contribute, donator được cấp shares tương ứng
   * - shares thường dùng để chia reward về sau
   */
  fundContract.on("SharesIssued", async (eventId, donator, sharesMinted, event) => {
    try {
      const meta = getEventMeta(event);

      await processFundEvent("SharesIssued", {
        eventId: eventId.toString(),
        donator,
        sharesMinted: sharesMinted.toString(),
        ...meta,
      });
    } catch (error) {
      console.error("[FundListener] SharesIssued error:", error);
    }
  });

  /**
   * =========================================================
   * 4) FundingSuccessful
   * =========================================================
   *
   * Solidity:
   * FundingSuccessful(eventId)
   *
   * Ý nghĩa:
   * - event đã đạt funding goal
   * - nhưng chưa chắc đã finalized
   */
  fundContract.on("FundingSuccessful", async (eventId, event) => {
    try {
      const meta = getEventMeta(event);

      await processFundEvent("FundingSuccessful", {
        eventId: eventId.toString(),
        ...meta,
      });
    } catch (error) {
      console.error("[FundListener] FundingSuccessful error:", error);
    }
  });

  /**
   * =========================================================
   * 5) FundingFinalized
   * =========================================================
   *
   * Solidity:
   * FundingFinalized(eventId, totalShares, statusAfterFinalize)
   *
   * Ý nghĩa:
   * - funding phase được chốt lại
   * - statusAfterFinalize cho biết event được Funded hay Cancelled
   */
  fundContract.on("FundingFinalized", async (eventId, totalShares, statusAfterFinalize, event) => {
    try {
      const meta = getEventMeta(event);

      await processFundEvent("FundingFinalized", {
        eventId: eventId.toString(),
        totalShares: totalShares.toString(),
        statusAfterFinalize: statusAfterFinalize.toString(),
        ...meta,
      });
    } catch (error) {
      console.error("[FundListener] FundingFinalized error:", error);
    }
  });

  /**
   * =========================================================
   * 6) TicketingStarted
   * =========================================================
   *
   * Solidity:
   * TicketingStarted(eventId, mintedQty, ticketType)
   *
   * Ý nghĩa:
   * - event bắt đầu phase ticketing
   * - mintedQty là số lượng vé được mint trong batch này
   * - ticketType là loại vé
   */
  fundContract.on("TicketingStarted", async (eventId, mintedQty, ticketType, event) => {
    try {
      const meta = getEventMeta(event);

      await processFundEvent("TicketingStarted", {
        eventId: eventId.toString(),
        mintedQty: mintedQty.toString(),
        ticketType: ticketType.toString(),
        ...meta,
      });
    } catch (error) {
      console.error("[FundListener] TicketingStarted error:", error);
    }
  });

  /**
   * =========================================================
   * 7) Completed
   * =========================================================
   *
   * Solidity:
   * Completed(eventId, usedTickets)
   *
   * Ý nghĩa:
   * - event đã được đánh dấu completed
   * - usedTickets là số vé đã được dùng/check-in
   */
  fundContract.on("Completed", async (eventId, usedTickets, event) => {
    try {
      const meta = getEventMeta(event);

      await processFundEvent("Completed", {
        eventId: eventId.toString(),
        usedTickets: usedTickets.toString(),
        ...meta,
      });
    } catch (error) {
      console.error("[FundListener] Completed error:", error);
    }
  });

  /**
   * =========================================================
   * 8) RevenueReleased
   * =========================================================
   *
   * Solidity:
   * RevenueReleased(
   *   eventId,
   *   totalRevenue,
   *   platformFee,
   *   organizerShare,
   *   donatorPool,
   *   newAccRewardPerShare
   * )
   *
   * Ý nghĩa:
   * - doanh thu đã được release
   * - chia thành:
   *   + platformFee
   *   + organizerShare
   *   + donatorPool
   * - newAccRewardPerShare dùng cho tính reward của donator
   */
  fundContract.on(
    "RevenueReleased",
    async (eventId, totalRevenue, platformFee, organizerShare, donatorPool, newAccRewardPerShare, event) => {
      try {
        const meta = getEventMeta(event);

        await processFundEvent("RevenueReleased", {
          eventId: eventId.toString(),
          totalRevenue: totalRevenue.toString(),
          platformFee: platformFee.toString(),
          organizerShare: organizerShare.toString(),
          donatorPool: donatorPool.toString(),
          newAccRewardPerShare: newAccRewardPerShare.toString(),
          ...meta,
        });
      } catch (error) {
        console.error("[FundListener] RevenueReleased error:", error);
      }
    }
  );

  /**
   * =========================================================
   * 9) RewardClaimed
   * =========================================================
   *
   * Solidity:
   * RewardClaimed(eventId, donator, amount)
   *
   * Ý nghĩa:
   * - donator claim phần reward được chia từ doanh thu event
   */
  fundContract.on("RewardClaimed", async (eventId, donator, amount, event) => {
    try {
      const meta = getEventMeta(event);

      await processFundEvent("RewardClaimed", {
        eventId: eventId.toString(),
        donator,
        amount: amount.toString(),
        ...meta,
      });
    } catch (error) {
      console.error("[FundListener] RewardClaimed error:", error);
    }
  });

  /**
   * =========================================================
   * 10) RefundsEnabled
   * =========================================================
   *
   * Solidity:
   * RefundsEnabled(eventId, refundPoolAmount)
   *
   * Ý nghĩa:
   * - event đã bật chế độ refund
   * - refundPoolAmount là pool hiện có để trả refund
   */
  fundContract.on("RefundsEnabled", async (eventId, refundPoolAmount, event) => {
    try {
      const meta = getEventMeta(event);

      await processFundEvent("RefundsEnabled", {
        eventId: eventId.toString(),
        refundPoolAmount: refundPoolAmount.toString(),
        ...meta,
      });
    } catch (error) {
      console.error("[FundListener] RefundsEnabled error:", error);
    }
  });

  /**
   * =========================================================
   * 11) TicketRefundPaid
   * =========================================================
   *
   * Solidity:
   * TicketRefundPaid(eventId, tokenId, to, amount)
   *
   * Ý nghĩa:
   * - Fund đã trả refund cho 1 ticket cụ thể
   * - to là người nhận tiền refund
   */
  fundContract.on("TicketRefundPaid", async (eventId, tokenId, to, amount, event) => {
    try {
      const meta = getEventMeta(event);

      await processFundEvent("TicketRefundPaid", {
        eventId: eventId.toString(),
        tokenId: tokenId.toString(),
        to,
        amount: amount.toString(),
        ...meta,
      });
    } catch (error) {
      console.error("[FundListener] TicketRefundPaid error:", error);
    }
  });

  /**
   * =========================================================
   * 12) PenaltyApplied
   * =========================================================
   *
   * Solidity:
   * PenaltyApplied(eventId, amount, penaltyBps, reason)
   *
   * Ý nghĩa:
   * - admin áp penalty lên organizer stake
   * - amount là số tiền bị slash
   * - penaltyBps là tỷ lệ phạt
   * - reason là enum lý do phạt
   */
  fundContract.on("PenaltyApplied", async (eventId, amount, penaltyBps, reason, event) => {
    try {
      const meta = getEventMeta(event);

      await processFundEvent("PenaltyApplied", {
        eventId: eventId.toString(),
        amount: amount.toString(),
        penaltyBps: penaltyBps.toString(),
        reason: reason.toString(),
        ...meta,
      });
    } catch (error) {
      console.error("[FundListener] PenaltyApplied error:", error);
    }
  });

  /**
   * =========================================================
   * 13) TicketRevenueDeposited
   * =========================================================
   *
   * Solidity:
   * TicketRevenueDeposited(eventId, from, amount, newEscrowedRevenue)
   *
   * Ý nghĩa:
   * - Ticket contract chuyển doanh thu vé vào Fund escrow
   * - newEscrowedRevenue là tổng escrow mới của event
   */
  fundContract.on("TicketRevenueDeposited", async (eventId, from, amount, newEscrowedRevenue, event) => {
    try {
      const meta = getEventMeta(event);

      await processFundEvent("TicketRevenueDeposited", {
        eventId: eventId.toString(),
        from,
        amount: amount.toString(),
        newEscrowedRevenue: newEscrowedRevenue.toString(),
        ...meta,
      });
    } catch (error) {
      console.error("[FundListener] TicketRevenueDeposited error:", error);
    }
  });

  /**
   * =========================================================
   * 14) RoyaltyDeposited
   * =========================================================
   *
   * Solidity:
   * RoyaltyDeposited(eventId, from, amount, newEscrowedRevenue)
   *
   * Ý nghĩa:
   * - Marketplace chuyển royalty từ secondary sale vào Fund
   * - cũng làm tăng escrowedRevenue của event
   */
  fundContract.on("RoyaltyDeposited", async (eventId, from, amount, newEscrowedRevenue, event) => {
    try {
      const meta = getEventMeta(event);

      await processFundEvent("RoyaltyDeposited", {
        eventId: eventId.toString(),
        from,
        amount: amount.toString(),
        newEscrowedRevenue: newEscrowedRevenue.toString(),
        ...meta,
      });
    } catch (error) {
      console.error("[FundListener] RoyaltyDeposited error:", error);
    }
  });

  /**
   * =========================================================
   * 15) ContributionRefunded
   * =========================================================
   *
   * Solidity:
   * ContributionRefunded(eventId, donator, amount)
   *
   * Ý nghĩa:
   * - donator được refund lại contribution khi event bị cancel
   */
  fundContract.on("ContributionRefunded", async (eventId, donator, amount, event) => {
    try {
      const meta = getEventMeta(event);

      await processFundEvent("ContributionRefunded", {
        eventId: eventId.toString(),
        donator,
        amount: amount.toString(),
        ...meta,
      });
    } catch (error) {
      console.error("[FundListener] ContributionRefunded error:", error);
    }
  });

  /**
   * =========================================================
   * 16) StakeWithdrawn
   * =========================================================
   *
   * Solidity:
   * StakeWithdrawn(eventId, organizer, amount)
   *
   * Ý nghĩa:
   * - organizer rút lại phần stake đã lock
   */
  fundContract.on("StakeWithdrawn", async (eventId, organizer, amount, event) => {
    try {
      const meta = getEventMeta(event);

      await processFundEvent("StakeWithdrawn", {
        eventId: eventId.toString(),
        organizer,
        amount: amount.toString(),
        ...meta,
      });
    } catch (error) {
      console.error("[FundListener] StakeWithdrawn error:", error);
    }
  });
}

/**
 * Gỡ toàn bộ listeners của Fund contract
 *
 * Dùng khi:
 * - restart server
 * - hot reload
 * - tránh đăng ký trùng listener
 */
export async function stopFundListeners() {
  if (fundContract) {
    fundContract.removeAllListeners();
    console.log("[FundListener] All listeners removed");
  }
}

// Export contract instance nếu nơi khác cần dùng
export { fundContract };