# Kiến trúc cập nhật - EventFund Ticket Platform

Tài liệu này mô tả kiến trúc đang áp dụng cho dự án `Eventfund-platform`.

Mục tiêu của hệ thống:

- Gây quỹ cho sự kiện bằng blockchain.
- Mint và quản lý vé NFT.
- Mua bán vé sơ cấp và thứ cấp.
- Xác thực vé tại cổng check-in.
- Đồng bộ dữ liệu on-chain về backend để phục vụ tra cứu, dashboard và analytics.
- Hỗ trợ nạp tiền VND qua VNPay rồi xử lý chuyển ETH cho ví người dùng qua relayer.

---

## 1. Tổng quan kiến trúc hệ thống

```text
┌────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React + Vite)                  │
│  Public pages  |  User dashboard  |  Verifier dashboard | Admin   │
│  Web3Auth login |  Wallet connect  |  QR check-in        | Admin   │
└───────────────────────────────┬────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js + Express)                     │
│  Auth / SIWE / JWT                                                   │
│  Event, Ticket, Marketplace, User, Deposit APIs                      │
│  Blockchain indexers + processors                                   │
│  VNPay deposit worker + relayer                                     │
│  Redis cache + MongoDB + Cloudinary + IPFS                          │
└───────────────────────────────┬────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                 SMART CONTRACTS (Hardhat / Solidity)               │
│  Fund.sol     |  Ticket.sol     |  Marketplace.sol                 │
│  funding      |  NFT ticket     |  resale + royalty                │
│  revenue/refund|  used/refund    |  atomic buy/sell                 │
└────────────────────────────────────────────────────────────────────┘
```

### Phạm vi triển khai hiện tại

- Đây không phải mô hình “share token đầu tư” thuần on-chain như bản kế hoạch gốc.
- Dự án đang đi theo mô hình:
  - `Fund.sol` quản lý funding, stake, revenue, refund.
  - `Ticket.sol` quản lý mint, purchase, use, refund và trạng thái vé.
  - `Marketplace.sol` quản lý listing và giao dịch vé resale.
- Backend không làm proxy giao dịch cho user, nhưng có:
  - auth/login,
  - đồng bộ dữ liệu blockchain,
  - xử lý deposit VND -> ETH,
  - quản lý hồ sơ, vé, listing, investment, analytics.

---

## 2. Phân chia trách nhiệm

### Frontend

- Login bằng Web3Auth.
- Kết nối ví và chuyển sang Sepolia.
- Hiển thị các layout:
  - Public
  - User
  - Verifier
  - Admin
- Tạo event, xem funding, mua vé, bán vé, check-in QR.
- Gửi giao dịch on-chain từ phía client khi cần.
- Hiển thị trạng thái tx, pending, success, failed.
- Đồng bộ UI với backend API và dữ liệu on-chain.

### Backend

- Xác thực người dùng bằng token và luồng wallet login.
- Quản lý user, event, ticket, listing, investment, deposit.
- Đồng bộ log blockchain vào MongoDB.
- Cung cấp API tìm kiếm, lọc, phân trang, dashboard.
- Xử lý deposit VNPay và chuyển tiền bằng relayer.
- Cache dữ liệu nóng bằng Redis.
- Cung cấp API check-in và verify ticket.

### Smart contracts

#### `Fund.sol`

- Tạo và quản lý sự kiện funding.
- Nhận stake của organizer.
- Nhận contribution / investment từ user.
- Theo dõi trạng thái funding, finalize, release revenue, refund.
- Tính toán phần chia doanh thu và penalty.

#### `Ticket.sol`

- Mint batch vé theo event.
- Xử lý purchase.
- Theo dõi trạng thái vé:
  - minted
  - sold
  - used
  - expired
  - refunded
- Cung cấp usage stats cho backend và `Fund.sol`.
- Quản lý verifier cho từng event.

#### `Marketplace.sol`

- Tạo listing.
- Mua listing.
- Hủy listing.
- Chuyển vé atomically.
- Tính royalty và cập nhật doanh thu liên quan.

---

## 3. Dữ liệu on-chain và off-chain

### On-chain

| Dữ liệu | Lý do |
|---|---|
| Stake của organizer | Minh bạch và có thể bị phạt tự động |
| Contribution / investment | Không cần tin backend |
| Sở hữu vé NFT | Chứng minh ownership |
| Trạng thái vé used / expired / refunded | Là nguồn sự thật cho check-in |
| Listing và giao dịch resale | Atomic, trustless |
| Royalty / revenue split | Không thể sửa sau khi ghi nhận |
| Usage stats để kích hoạt release / refund | Tránh gian lận |

### Off-chain

| Dữ liệu | Nơi lưu | Lý do |
|---|---|---|
| Hồ sơ người dùng | MongoDB | Phù hợp quyền riêng tư và truy vấn |
| Draft event, metadata, ảnh | MongoDB + IPFS + Cloudinary | Dễ cập nhật, ít tốn gas |
| Deposit order VNPay | MongoDB | Phục vụ payment flow |
| User balance | MongoDB | Theo dõi số dư nạp / rút |
| Chain logs thô | MongoDB | Phục vụ indexer / processor |
| Stats tổng hợp | MongoDB | Query nhanh cho dashboard |
| Cache nóng | Redis | Giảm tải DB và RPC |

---

## 4. Database schema thực tế

### `users`

- `walletAddress`
- `username`
- `email`
- `avatarUrl`
- `role`: `user | verifier | admin`
- `nonce`

### `events`

- `contractEventId`
- `fundContractAddress`
- `title`
- `description`
- `category`
- `organizer`
- `onChainOrganizer`
- `organizerStake`
- `minStakeRequired`
- `minInvestmentAmount`
- `fundingGoal`
- `currentFunding`
- `organizerShareBps`
- `investmentEnabled`
- `fundingDeadline`
- `ticketPrice`
- `maxTickets`
- `usedThreshold`
- `ticketingStartAt`
- `ticketingEndAt`
- `startDate`
- `endDate`
- `status`
- `verifiers[]`
- `venue.address`
- `imageUrls[]`
- `metadataUri`
- `totalTickets`
- `ticketsSold`
- `totalTicketsUsed`
- `ticketTiers[]`
- `ticketUsageThreshold`
- `escrowStatus`
- `totalRevenue`
- `platformFee`
- `organizerShare`
- `donatorPool`
- `refundPool`
- `revenueReleased`
- `refundsEnabled`
- `sharesFinalized`

### `contributions`

- `eventId`
- `contributor`
- `type`: `organizer_stake | donator_contribution`
- `amount`
- `sharePercentage`
- `shareTokenId`
- `txHash`
- `blockNumber`
- `timestamp`
- `status`

### `shares`

- `eventId`
- `holder`
- `contributionAmount`
- `sharePercentage`
- `shareTokenId`
- `claimedReward`
- `pendingReward`
- `mintedShares`

### `tickets`

- `tokenId`
- `eventId`
- `currentOwner`
- `originalPrice`
- `ticketType`
- `metadataUri`
- `status`
- `soldAt`
- `usedAt`
- `usedTxHash`
- `refundedAt`
- `refundedTxHash`
- `verifiedBy`
- `isListed`
- `transferHistory[]`

### `listings`

- `contractListingId`
- `ticketId`
- `tokenId`
- `eventId`
- `seller`
- `price`
- `maxPrice`
- `listedAt`
- `status`
- `txHash`
- `expiresAt`
- `soldTo`
- `soldAt`
- `soldTxHash`

### `revenue_distributions`

- `eventId`
- `totalRevenue`
- `platformFee`
- `platformFeePercentage`
- `organizerShare`
- `organizerSharePercentage`
- `donatorPool`
- `status`
- `triggeredAt`
- `completedAt`
- `txHash`
- `ticketUsageRatio`
- `triggerType`

### `reward_claims`

- `distributionId`
- `eventId`
- `claimer`
- `sharePercentage`
- `rewardAmount`
- `txHash`
- `claimedAt`
- `status`

### `penalties`

- `eventId`
- `organizer`
- `stakeAmount`
- `penaltyAmount`
- `penaltyPercentage`
- `reason`
- `txHash`
- `processedAt`
- `status`

### `deposit_orders` và `user_balances`

- `DepositOrder` lưu đơn nạp VND, trạng thái VNPay, tx chuyển tiền.
- `UserBalance` lưu tổng nạp, tổng rút, số dư khả dụng theo ví.

### `chain_logs`, `ticket_events`, `ticket_stats`, `blockchain_sync_state`

- `ChainLog`: log thô từ chain.
- `TicketEvent`: log chuẩn hóa cho ticket.
- `TicketStats`: thống kê theo event.
- `BlockchainSyncState`: checkpoint và trạng thái sync.

---

## 5. Luồng dữ liệu chính

### Luồng 1: Đăng nhập và đồng bộ tài khoản

1. User connect qua Web3Auth.
2. Frontend lấy identity token và ví EOA / smart account.
3. Backend nhận login, cấp JWT, lưu wallet address.
4. Frontend gọi `GET /api/users/profile` để dựng dashboard.

### Luồng 2: Tạo event

1. Organizer tạo draft event trên frontend.
2. Backend lưu dữ liệu off-chain, upload ảnh / metadata lên Cloudinary hoặc IPFS.
3. Organizer gọi tx on-chain để khởi tạo event / funding.
4. Backend listener bắt event mới và đồng bộ về MongoDB.

### Luồng 3: Funding / investment

1. User xem event đang funding.
2. User đầu tư trực tiếp on-chain nếu flow đó đang bật trong contract.
3. Backend ghi nhận contribution và cập nhật `shares`.
4. UI cập nhật progress, quyền lợi, pending reward.

### Luồng 4: Nạp VND qua VNPay

1. User tạo deposit order.
2. Backend tạo payment URL VNPay.
3. VNPay trả IPN / return URL.
4. `DepositProcessorService` chuyển ETH bằng relayer.
5. `UserBalance` được cập nhật.

### Luồng 5: Mint và mua vé

1. Organizer mint batch vé trong `Ticket.sol`.
2. Listener tạo record vào `tickets`.
3. Buyer mua vé primary sale bằng tx on-chain.
4. `TicketPurchased` được index, `ticketsSold` và `totalRevenue` được cập nhật.

### Luồng 6: Bán lại vé

1. Owner tạo listing trên `Marketplace.sol`.
2. Backend lưu `listings` và cache.
3. Buyer mua listing.
4. Contract chuyển vé và chia tiền.
5. Listener cập nhật owner, trạng thái listing và doanh thu liên quan.

### Luồng 7: Xác thực vé

1. Attendee đưa QR chứa `tokenId` + chữ ký.
2. Verifier quét QR trên màn hình verifier.
3. Backend kiểm tra `ownerOf`, chữ ký, trạng thái ticket.
4. Verifier / backend trigger `markAsUsed`.
5. Listener cập nhật `usedAt`, `usedCount`, `verifiedBy`.

### Luồng 8: Release revenue / refund

1. Hệ thống kiểm tra điều kiện:
   - event đã kết thúc,
   - tỷ lệ vé dùng đạt ngưỡng,
   - hoặc event bị fail / hủy.
2. `Fund.sol` thực hiện release revenue hoặc mở refund.
3. Backend listener ghi nhận distribution / penalty / refund.
4. Donator claim reward nếu event thành công.
5. Ticket holder claim refund nếu event thất bại.

---

## 6. Backend indexing và xử lý blockchain

Hệ thống backend hiện có 3 lớp liên quan chain:

- **Indexer**
  - `indexer:ticket`
  - `indexer:fund`
  - `indexer:marketplace`
  - Lấy log từ RPC và lưu vào `ChainLog`.

- **Processor**
  - `processor:ticket`
  - `processor:fund`
  - `processor:marketplace`
  - Biến log thô thành dữ liệu query-friendly.

- **Sync state**
  - Lưu checkpoint trong `BlockchainSyncState`.
  - Có xử lý reorg bằng cách rescan cửa sổ block gần nhất.

Chiến lược này giúp:

- idempotent,
- chống double-processing,
- xử lý chain reorg,
- rebuild dữ liệu derived khi cần.

---

## 7. Caching với Redis

Các nhóm dữ liệu nên cache:

- event detail
- funding progress
- ticket stats
- listings theo page / theo event
- user tickets
- user investments / shares
- user balance
- nonce login

Nguyên tắc:

- dữ liệu quan trọng phải invalidate ngay sau event on-chain,
- dữ liệu thống kê có thể chấp nhận stale ngắn,
- backend listener nên publish invalidation khi có tx mới.

---

## 8. Bảo mật và nhất quán

### Bảo mật

- Login bằng wallet + JWT.
- RBAC: `user`, `verifier`, `admin`.
- Rate limit và validation ở backend.
- CORS, Helmet, logging chuẩn.
- Chỉ verifier được phép check-in vé.
- Chỉ admin được xem các màn quản trị nhạy cảm.

### Tính nhất quán

- Dùng `txHash` làm khóa idempotent.
- Không tin dữ liệu pending ở backend nếu chưa được chain xác nhận.
- Frontend nên hiển thị trạng thái chờ sync khi tx vừa gửi.
- Backend phải luôn có đường “rebuild” từ chain logs.

---
