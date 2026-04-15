1) Fund Processor (đã fix)

Mỗi vòng chạy:

Tính fromBlock = lastProcessedBlock - reorgBuffer + 1.
Query ChainLog theo chunk.
So sánh recentBlockHashes đã lưu với block hiện tại:
Block biến mất: collect txHashes từ savedEntry.
Block hash thay đổi: collect txHashes từ savedEntry (block cũ), không xóa tx canonical mới.
Process logs như bình thường (upsert/idempotent).
Sau chunk:
deleteByTxHashes cho Contribution/Penalty/RevenueDistribution/RewardClaim.
clearProcessedTxHashes trên Event và processedRewardTxHashes trên Share.
rebuildFullEventStateFromChainLog theo eventId bị ảnh hưởng.
Rebuild lại Share và claimedReward, sau đó rebuildFundState.
Idempotency (Fund)
Đã đổi các flow check-then-mark thành update atomic theo (txHash, field).
Mục tiêu: tránh race condition TOCTOU khi nhiều worker xử lý cùng tx.
2) Ticket Processor (đã fix)

Mỗi vòng chạy:

Query chunk ChainLog canonical.
Lấy preDeleteEventIds từ TicketEvent trong range.
deleteInRange TicketEvent.
insertMany docs mới từ ChainLog canonical.
Rebuild stats với hợp eventIds = preDeleteEventIds ∪ postInsertEventIds.
Ý nghĩa
Khi canonical chunk rỗng (log biến mất do reorg), stats vẫn được rebuild đúng, không bị giữ số cũ.
3) Marketplace Processor (đã fix)

Mỗi vòng chạy:

Query chunk ChainLog canonical.
So sánh recentBlockHashes:
Block biến mất: collect listingIds từ savedEntry.
Block hash thay đổi: collect cả listingIds từ savedEntry và từ canonical logs.
Process logs như bình thường.
Sau chunk, rebuildListingFromChainLog cho tất cả listingIds bị ảnh hưởng.
Ý nghĩa
Không bỏ sót listing cũ trong trường hợp hash-changed, kể cả khi listing create nằm ngoài reorg buffer.
Regression tests (trạng thái hiện tại)
File test: backend/src/tests/integration/blockchain/reorg-safety.integration.test.js
Đã bao phủ các case:
Fund hash-changed orphan tx cleanup
Ticket stats khi canonical chunk rỗng
Marketplace hash-changed listing cũ ngoài reorg buffer
Fund idempotency race TOCTOU
Kết quả hiện tại: 6/6 pass.