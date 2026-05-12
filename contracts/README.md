# Smart Contracts (Hardhat)

## Project Notes

- Ticket quick fixes (Phase 1): see [docs/ticket-fixes.md](docs/ticket-fixes.md)
- Fund quick fixes (Phase 1): see [docs/fund-fixes.md](docs/fund-fixes.md)
- Marketplace quick fixes (Phase 1): see [docs/marketplace-fixes.md](docs/marketplace-fixes.md)

Thư mục này chứa 3 smart contracts chính (Ticket/Fund/Marketplace) và script deploy.

## Yêu cầu

- Node.js >= 18
- Có file `.env` trong thư mục `contracts/`

Lưu ý: project dùng ESM (`"type": "module"`) nên các file config/script deploy dùng `import/export`.

## Cài dependencies

Từ thư mục `contracts/`:

```shell
npm ci
```

## Local deploy (localhost)

Terminal 1 (chạy chain local):

```shell
npm run chain
```

Terminal 2 (deploy 3 contracts lên localhost):

```shell
npm run deploy:all
```

Nếu gặp lỗi `ECONNREFUSED 127.0.0.1:8545` hoặc `HH108: Cannot connect to the network localhost`,
nghĩa là local chain chưa chạy. Hãy mở terminal khác và chạy `npm run chain` trước.
Nếu bạn muốn deploy lên Sepolia thay vì local, dùng `npm run deploy:sepolia`.

`deploy:all` sẽ:

- Deploy lần lượt `Ticket`, `Fund`, `Marketplace`.
- Tự động “wire” các contract để flow chạy end-to-end:
  - `Ticket.setFundContract(Fund)`
  - `Fund.setTicketContract(Ticket)`
  - `Fund.setMarketplaceContract(Marketplace)`
- Upsert các địa chỉ vào 2 file:
  - `contracts/.env`
  - `../backend/.env`

## Deploy Sepolia testnet

### 1) Chuẩn bị `.env`cls

Tạo/ cập nhật `contracts/.env` với các biến sau:

```env
SEPOLIA_RPC_URL=https://...
PRIVATE_KEY=...            # private key ví deploy (có/không có 0x đều được)

# optional
ROYALTY_BPS=500
DEPLOY_CONFIRMATIONS=1
```

### 2) Compile

```shell
npx hardhat compile
```

### 3) Deploy

```shell
npm run deploy:sepolia
```

Sau khi deploy xong, script sẽ in ra địa chỉ và cũng upsert vào `contracts/.env` và `../backend/.env`.

## Ghi chú bảo mật

- Không commit `.env` lên Git.
- Không chia sẻ `PRIVATE_KEY` qua chat/log. Nếu lỡ lộ key, hãy rotate (tạo key mới) ngay.

## Useful commands

```shell
npx hardhat help
npx hardhat node
npm test
npx hardhat ignition deploy ./ignition/modules/Lock.js
```

## Test

Chạy toàn bộ test smart contract từ thư mục `contracts/`:

```shell
npm test
```

Nếu cần chạy trực tiếp bằng Hardhat:

```shell
npx hardhat test
```
