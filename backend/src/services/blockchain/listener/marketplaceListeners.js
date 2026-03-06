import { getMarketplace } from "../core/contracts/index.js";

// Giữ contract instance ở scope file để có thể:
// - chỉ init 1 lần
// - remove listeners khi cần restart / stop
let marketplaceContract;

/**
 * Khởi tạo Marketplace listener
 *
 * @param {Function} processMarketplaceEvent
 * Hàm processor do bạn hoặc teammate truyền vào.
 * Listener chỉ nghe event và đóng gói payload.
 */
export async function initMarketplaceListeners(processMarketplaceEvent) {
  try {
    // Lấy contract instance từ core/contracts/index.js
    marketplaceContract = getMarketplace();

    // In địa chỉ contract để debug dễ hơn
    const address = await marketplaceContract.getAddress();
    console.log(`[MarketplaceListener] Listening on contract: ${address}`);

    // Đăng ký toàn bộ listeners
    setupMarketplaceEventListeners(processMarketplaceEvent);

    console.log("[MarketplaceListener] Initialized successfully");
  } catch (error) {
    console.error("[MarketplaceListener] Init failed:", error);
    throw error;
  }
}

/**
 * Đăng ký listeners cho từng event của Marketplace.sol
 */
function setupMarketplaceEventListeners(processMarketplaceEvent) {
  if (!marketplaceContract) {
    throw new Error("Marketplace contract is not initialized");
  }

  /**
   * Helper lấy metadata từ object event của ethers v6
   *
   * Mấy field này rất quan trọng để:
   * - trace giao dịch
   * - biết event ở block nào
   * - chống duplicate bằng transactionHash + logIndex
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
   * 1) ListingCreated(...)
   * =========================================================
   *
   * Từ Marketplace.sol:
   * emit ListingCreated(listingId, tokenId, msg.sender, price, maxPrice);
   *
   * Ý nghĩa:
   * - seller tạo listing mới cho ticket
   * - listingId: mã listing
   * - tokenId: id NFT ticket
   * - seller: người bán
   * - price: giá bán hiện tại
   * - maxPrice: giá trần theo contract
   */
  marketplaceContract.on(
    "ListingCreated",
    async (listingId, tokenId, seller, price, maxPrice, event) => {
      try {
        const meta = getEventMeta(event);

        await processMarketplaceEvent("ListingCreated", {
          listingId: listingId.toString(),
          tokenId: tokenId.toString(),
          seller,
          price: price.toString(),
          maxPrice: maxPrice.toString(),
          ...meta,
        });
      } catch (error) {
        console.error("[MarketplaceListener] ListingCreated error:", error);
      }
    }
  );

  /**
   * =========================================================
   * 2) ListingSold(...)
   * =========================================================
   *
   * Từ Marketplace.sol:
   * emit ListingSold(listingId, tokenId, msg.sender, seller, listing.price, royaltyAmount);
   *
   * Ý nghĩa:
   * - buyer mua listing thành công
   * - listingId: mã listing
   * - tokenId: NFT nào được bán
   * - buyer: người mua
   * - seller: người bán
   * - price: giá giao dịch
   * - royaltyAmount: phần royalty chuyển về Fund
   */
  marketplaceContract.on(
    "ListingSold",
    async (listingId, tokenId, buyer, seller, price, royaltyAmount, event) => {
      try {
        const meta = getEventMeta(event);

        await processMarketplaceEvent("ListingSold", {
          listingId: listingId.toString(),
          tokenId: tokenId.toString(),
          buyer,
          seller,
          price: price.toString(),
          royaltyAmount: royaltyAmount.toString(),
          ...meta,
        });
      } catch (error) {
        console.error("[MarketplaceListener] ListingSold error:", error);
      }
    }
  );

  /**
   * =========================================================
   * 3) ListingCancelled(...)
   * =========================================================
   *
   * Từ Marketplace.sol:
   * emit ListingCancelled(listingId, tokenId, msg.sender);
   *
   * Ý nghĩa:
   * - seller hủy listing
   * - listingId: mã listing
   * - tokenId: NFT liên quan
   * - seller: người hủy listing
   */
  marketplaceContract.on(
    "ListingCancelled",
    async (listingId, tokenId, seller, event) => {
      try {
        const meta = getEventMeta(event);

        await processMarketplaceEvent("ListingCancelled", {
          listingId: listingId.toString(),
          tokenId: tokenId.toString(),
          seller,
          ...meta,
        });
      } catch (error) {
        console.error("[MarketplaceListener] ListingCancelled error:", error);
      }
    }
  );
}

/**
 * Gỡ toàn bộ listeners của Marketplace contract
 *
 * Dùng khi:
 * - restart server
 * - hot reload
 * - tránh listener bị bind trùng
 */
export async function stopMarketplaceListeners() {
  if (marketplaceContract) {
    marketplaceContract.removeAllListeners();
    console.log("[MarketplaceListener] All listeners removed");
  }
}

// Export instance nếu nơi khác cần dùng
export { marketplaceContract };