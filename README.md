# EventFund Platform

EventFund is a Web3 event funding and ticketing platform with three main parts:

- `frontend/`: React + Vite client
- `backend/`: Express API, MongoDB data layer, SIWE/Web3Auth auth flow, blockchain sync workers
- `contracts/`: Solidity contracts and Hardhat deployment scripts

The platform supports event creation, crowdfunding, NFT ticket issuance, secondary marketplace listings, verifier check-in flows, admin operations, and VNPay-based deposit flows.

## Repository Layout

```text
Eventfund-platform/
|-- frontend/       React app (Vite)
|-- backend/        Express API + MongoDB + blockchain workers
|-- contracts/      Solidity contracts + Hardhat scripts
|-- infrastructure/ Terraform and EC2 Docker deployment assets
|-- docker-compose.yml
|-- Dockerfile
`-- README.md
```

## Core Features

- SIWE authentication and Web3Auth-based login
- Event creation, editing, funding lifecycle, and organizer flows
- NFT ticket purchase, refund, verification, and check-in flows
- Secondary marketplace listing and purchase flows
- Admin dashboards for users, events, marketplace activity, and platform stats
- Blockchain log indexing and processing into MongoDB query models
- VNPay deposit flow with frontend redirect and backend callback handling

## Tech Stack

### Frontend

- React 18
- React Router 7
- Vite 6
- Tailwind CSS 4
- Web3Auth
- MUI + Radix UI

### Backend

- Node.js + Express 5
- MongoDB + Mongoose
- JWT + SIWE
- Swagger/OpenAPI
- Ethers 6
- Cloudinary
- VNPay integration
- Jest + Supertest

### Smart Contracts

- Solidity 0.8.20
- Hardhat
- OpenZeppelin Contracts

## Prerequisites

- Node.js 18+ recommended
- npm
- MongoDB
- A Sepolia RPC URL for full blockchain flows
- A deployer private key for contract deployment

Optional, depending on what you want to run:

- Cloudinary account for image upload
- Web3Auth project credentials
- VNPay sandbox credentials
- Pinata JWT

## Environment Files

This repo now includes example env files for all three apps:

- [backend/.env.example](/d:/KTLTWEB/Eventfund-platform/backend/.env.example)
- [frontend/.env.example](/d:/KTLTWEB/Eventfund-platform/frontend/.env.example)
- [contracts/.env.example](/d:/KTLTWEB/Eventfund-platform/contracts/.env.example)

Create real env files by copying the examples:

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
copy contracts\.env.example contracts\.env
```

If you are not on Windows, use `cp` instead of `copy`.

## Install Dependencies

This repo is not configured as an npm workspace, so install dependencies per package:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
npm install --prefix contracts
```

## Local Development

### 1. Minimal app startup

If you only want to boot the web app and API without the full local blockchain loop:

Terminal 1:

```bash
npm run backend start
```

Terminal 2:

```bash
npm run frontend dev
```

URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`
- Swagger docs: `http://localhost:4000/api-docs`
- Health check: `http://localhost:4000/health`

Use this mode if you are still preparing contract addresses, RPC access, or blockchain workers.

### 2. Full local Web3 flow

For the full dev loop with local chain, deployed contracts, API, and blockchain workers:

Terminal 1:

```bash
npm run contracts chain
```

Terminal 2:

```bash
npm run contracts deploy:all
```

This deploy script:

- deploys `Ticket`, `Fund`, and `Marketplace`
- wires the contracts together
- upserts deployed addresses into:
  - `contracts/.env`
  - `backend/.env`

Terminal 3:

```bash
npm run backend dev
```

Terminal 4:

```bash
npm run frontend dev
```

Notes:

- `npm run dev` at repo root starts `backend` and `frontend` together, but does not start the Hardhat node.
- `backend` dev mode also starts background loops:
  - fund indexer
  - fund processor
  - ticket indexer
  - ticket processor
  - deposit worker
- If blockchain env vars or contract addresses are missing, `npm run backend dev` can fail. In that case use the minimal startup path first.

## Available Scripts

### Root

```bash
npm run dev
npm run backend <script>
npm run frontend <script>
npm run contracts <script>
```

### Backend

```bash
npm run backend start
npm run backend dev
npm run backend test
npm run backend test:blockchain:connections
npm run backend indexer:ticket
npm run backend indexer:fund
npm run backend indexer:marketplace
npm run backend processor:ticket
npm run backend processor:fund
npm run backend processor:marketplace
npm run backend worker:deposits
npm run backend seed
npm run backend add:event-verifier
npm run backend verifier:test-qr
npm run backend cleanup:historical-fund
npm run backend migrate:event-fund-scope
```

### Frontend

```bash
npm run frontend dev
npm run frontend build
npm run frontend lint
```

### Contracts

```bash
npm run contracts chain
npm run contracts deploy:all
npm run contracts deploy:sepolia
npm run contracts deploy:fund
npm run contracts deploy:fund:sepolia
```

For contract tests, use Hardhat directly:

```bash
cd contracts
npx hardhat test
```

The current `contracts/package.json` test script is still a placeholder and does not run the suite.

## Frontend App Structure

The frontend is organized around three route groups:

- Public routes: home, explore, marketplace, event detail, ticket detail, login
- User routes: dashboard, my events, create/edit event, my tickets, investments, wallet, deposits, profile, settings
- Admin routes: dashboard, users, events, marketplace, fraud, finance, analytics, settings

There is also a verifier dashboard under:

- `/app/verifier/dashboard`

Authentication is handled through `AuthContext` and Web3Auth in:

- `frontend/src/app/contexts/AuthContext.tsx`
- `frontend/src/app/web3auth.config.ts`

## Backend API Overview

The backend exposes these main route groups:

- `/api/auth`: login, nonce, SIWE message, verify, logout, refresh
- `/api/events`: event listing, creation, edit, blockchain intent/confirm flows
- `/api/tickets`: ticket list, purchase intent, refund intent, verification, use/check-in
- `/api/marketplace`: listing CRUD and marketplace history/stats flows
- `/api/users`: user profile and user-related data
- `/api/admin`: platform stats, user role management, admin event operations
- `/api/deposits`: VNPay deposit creation, return/IPN handling, history, balances
- `/api/health`: API health endpoint

Swagger is generated from route annotations and served at:

- `http://localhost:4000/api-docs`
- `http://localhost:4000/api-docs.json`

## Blockchain Sync Pipeline

The backend contains long-running blockchain jobs that sync on-chain data into MongoDB:

- indexers read logs from RPC and store raw chain logs
- processors materialize query-friendly models for tickets, events, and marketplace data

Important docs:

- [backend/docs/blockchain-indexing.md](/d:/KTLTWEB/Eventfund-platform/backend/docs/blockchain-indexing.md)
- [backend/docs/giai_thich_reorg.md](/d:/KTLTWEB/Eventfund-platform/backend/docs/giai_thich_reorg.md)

## Contracts

Main contracts:

- `Ticket.sol`
- `Fund.sol`
- `Marketplace.sol`

Hardhat config loads env from `contracts/.env`. The deployer account is resolved from:

- `PRIVATE_KEY`, or
- `BACKEND_SIGNER_PRIVATE_KEY` as a fallback

Local and Sepolia deployment details are documented in:

- [contracts/README.md](/d:/KTLTWEB/Eventfund-platform/contracts/README.md)

## Testing

### Backend

```bash
npm run backend test
```

You can also generate a JSON report:

```bash
npm run backend test -- --json --outputFile jest-backend.json
```

### Contracts

```bash
cd contracts
npx hardhat test
```

### Helpful checks

```bash
npm run backend test:blockchain:connections
```

Additional backend testing notes:

- [backend/docs/backend-test-snapshot-2026-04-06.md](/d:/KTLTWEB/Eventfund-platform/backend/docs/backend-test-snapshot-2026-04-06.md)

## Docker and Deployment

This repo includes a backend-focused Docker setup:

- [Dockerfile](/d:/KTLTWEB/Eventfund-platform/Dockerfile)
- [docker-compose.yml](/d:/KTLTWEB/Eventfund-platform/docker-compose.yml)
- [docker-entrypoint.sh](/d:/KTLTWEB/Eventfund-platform/docker-entrypoint.sh)

Current container behavior:

- builds the backend image
- starts `backend/src/server.js`
- supports loading environment variables from AWS Systems Manager Parameter Store
- mounts backend logs to a Docker volume

Terraform assets for EC2 Docker deployment live under:

- [infrastructure/ec2-docker/terraform](/d:/KTLTWEB/Eventfund-platform/infrastructure/ec2-docker/terraform)

## Recommended First Run Checklist

1. Install dependencies in root, `backend`, `frontend`, and `contracts`.
2. Copy the three `.env.example` files into real `.env` files.
3. Fill in MongoDB and frontend/backend base URLs first.
4. If you want full blockchain flow, fill `contracts/.env` and deploy contracts.
5. Start backend and open `http://localhost:4000/api-docs`.
6. Start frontend and verify it can reach the backend.

## Known Notes

- The root `npm run dev` command does not start a Hardhat node.
- The backend dev script starts multiple long-running workers, not just the API server.
- Contract tests exist, but the `npm test` script inside `contracts/` is not wired yet.
- Some advanced flows require real third-party credentials: Cloudinary, Web3Auth, VNPay, Pinata, and RPC access.
