# EventFund Ticket Platform

Nền tảng tạo quỹ sự kiện, bán, trao đổi và chứng thực vé sự kiện trên blockchain.

## Kiến trúc

```
eventfund-ticket-platform/
├── frontend/          # React + Vite
├── backend/           # Express.js API
└── contracts/         # Solidity Smart Contracts (Hardhat)
```

## Tech Stack

### Frontend

- React 19
- Vite 7
- ESLint

### Backend

- Express.js 5
- MongoDB (Mongoose)
- Redis (ioredis)
- Helmet (Security)

### Smart Contracts

- Solidity
- Hardhat
- Hardhat Toolbox

## Cài đặt

### Yêu cầu

- Node.js >= 18
- MongoDB
- Redis

### 1. Clone repository

```bash
git clone https://github.com/kieuphat159/Eventfund-platform.git
cd eventfund-ticket-platform
```

### 2. Cài đặt dependencies

```bash
# Cài đặt tất cả
npm install
npm install --prefix backend
npm install --prefix frontend
npm install --prefix contracts
```

### 3. Cấu hình môi trường

Tạo file `.env` trong thư mục `backend/` (có thể copy từ `backend/.env.example`):

```env
PORT=4000
NODE_ENV=DEV

MONGO_DEV_URI=mongodb+srv://...
MONGO_PROD_URI=mongodb+srv://...

CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_KEY=your_cloudinary_key
CLOUDINARY_SECRET=your_cloudinary_secret

RPC_URL=http://127.0.0.1:8545

# get from hardhat deployment (deploy:all sẽ tự ghi 3 biến này)
TICKET_ADDRESS=0x...
FUND_ADDRESS=0x...
MARKETPLACE_ADDRESS=0x...
```

Tạo file `.env` trong thư mục `contracts/`:

```env
PRIVATE_KEY=your_wallet_private_key
SEPOLIA_RPC_URL=https://...
```

## Chạy ứng dụng

### Development

```bash
# Chạy cả frontend và backend
npm run dev

# Hoặc chạy riêng từng phần
npm run frontend dev      # Frontend tại http://localhost:5173
npm run backend dev       # Backend tại http://localhost:3000
```

### Smart Contracts

```bash
# Chạy blockchain local (Hardhat node) - mở 1 terminal riêng
npm run contracts chain

# Deploy cả 3 contracts (Ticket/Fund/Marketplace) lên localhost
# - Contract nào lỗi sẽ không chặn contract còn lại
# - Tự ghi TICKET_ADDRESS/FUND_ADDRESS/MARKETPLACE_ADDRESS vào backend/.env
npm run contracts deploy:all
```

### Deploy Sepolia testnet

Từ thư mục gốc:

```bash
# đảm bảo contracts/.env có PRIVATE_KEY và SEPOLIA_RPC_URL
npm run contracts deploy:sepolia
```

Chi tiết (các biến env optional, wiring tự động Ticket/Fund/Marketplace, upsert vào backend/.env): xem `contracts/README.md`.

### Local blockchain + backend (flow khuyến nghị)

Terminal 1:

```bash
cd contracts
npm run chain
```

Terminal 2:

```bash
cd contracts
npm run deploy:all
```

Terminal 3:

```bash
cd backend
npm run dev
```

Ghi chú:

- Backend đọc address từ `backend/.env` (các biến: `TICKET_ADDRESS`, `FUND_ADDRESS`, `MARKETPLACE_ADDRESS`).
- Backend được cấu hình để luôn load đúng `backend/.env` dù bạn chạy lệnh từ thư mục nào.

### Blockchain utilities (backend)

```bash
# Test connection tới RPC + cả 3 contracts (non-blocking)
npm run backend test:blockchain:connections

# Chạy các indexer loop
npm run backend indexer:ticket
npm run backend indexer:fund
npm run backend indexer:marketplace

# Chạy ticket processor loop (build TicketEvent/TicketStats từ ChainLog)
npm run backend processor:ticket
```

Tài liệu chi tiết (Indexer/Processor, reorg handling, env vars, data model):

- `backend/docs/blockchain-indexing.md`

## Cấu trúc chi tiết

### Backend (`/backend`)

```
backend/
└── src/
    ├── app.js          # Express app config
    ├── server.js       # Server entry point
    ├── config/         # Database, Redis config
    ├── modules/        # Feature modules
    ├── routes/         # API routes
    └── utils/          # Helper functions
```

### Frontend (`/frontend`)

```
frontend/
└── src/
    ├── main.jsx        # Entry point
    ├── App.jsx         # Root component
    ├── assets/         # Static assets
    └── ...
```

### Contracts (`/contracts`)

```
contracts/
├── contracts/
│   ├── Fund.sol        # Crowdfunding contract
│   ├── Ticket.sol      # NFT Ticket contract
│   └── Marketplace.sol # Ticket marketplace
├── test/               # Contract tests
└── ignition/           # Deployment scripts
```

## Smart Contracts

| Contract          | Mô tả                       |
| ----------------- | --------------------------- |
| `Fund.sol`        | Quản lý gây quỹ cho sự kiện |
| `Ticket.sol`      | NFT ticket cho sự kiện      |
| `Marketplace.sol` | Sàn giao dịch vé            |

## Testing

```bash
# Backend
npm run backend test:blockchain:connections

# Contracts (Hardhat)
cd contracts
npx hardhat test
```

