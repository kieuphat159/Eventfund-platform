import { BlockchainSyncState } from "../../../models/BlockchainSyncState.model.js";

export function normalizeContractAddress(contractAddress) {
    if (!contractAddress) return undefined;
    return String(contractAddress).toLowerCase();
}

export function assertValidBlockNumber(blockNumber) {
    const next = Number(blockNumber);
    if (!Number.isFinite(next) || next < 0) {
        throw new Error(`Invalid blockNumber: ${blockNumber}`);
    }
    return next;
}

// NOTE: the schema enforces unique contractName, and indexers should use
// contractName as the primary key. contractAddress is tracked as metadata.
export async function getOrInitSyncState({
    contractName,
    contractAddress,
    startBlock = 0,
}) {
    const normalizedAddress = normalizeContractAddress(contractAddress);
    const initialBlock = assertValidBlockNumber(startBlock);

    const existing = await BlockchainSyncState.findOne({ contractName });
    if (existing) return existing;

    return BlockchainSyncState.create({
        contractName,
        contractAddress: normalizedAddress ?? "",
        lastProcessedBlock: initialBlock,
        status: "synced",
        lastSyncAt: new Date(),
    });
}

export async function markSyncing(contractName) {
    await BlockchainSyncState.updateOne(
        { contractName },
        { $set: { status: "syncing", errorMessage: null } },
        { upsert: true }
    );
}

export async function updateProgress({
    contractName,
    contractAddress,
    lastProcessedBlock,
    lastBlockHash = null,
    recentBlockHashes = null,
    status = "syncing",
}) {
    const normalizedAddress = normalizeContractAddress(contractAddress);
    const next = assertValidBlockNumber(lastProcessedBlock);

    await BlockchainSyncState.updateOne(
        { contractName },
        {
            $set: {
                ...(normalizedAddress ? { contractAddress: normalizedAddress } : {}),
                lastProcessedBlock: next,
                ...(lastBlockHash ? { lastBlockHash } : {}),
                ...(recentBlockHashes ? { recentBlockHashes } : {}),
                lastSyncAt: new Date(),
                status,
            },
        },
        { upsert: true }
    );
}

export async function markSynced(contractName) {
    await BlockchainSyncState.updateOne(
        { contractName },
        { $set: { status: "synced", lastSyncAt: new Date() } },
        { upsert: true }
    );
}

export async function markError(contractName, err) {
    const message = err instanceof Error ? err.message : String(err);
    await BlockchainSyncState.updateOne(
        { contractName },
        {
            $set: {
                status: "error",
                errorMessage: message,
                lastSyncAt: new Date(),
            },
        },
        { upsert: true }
    );
}

export class BlockTracker {
    constructor(contractName, contractAddress) {
        this.contractName = contractName;
        this.contractAddress = contractAddress;
    }

    async getLastProcessedBlock() {
        const syncState = await BlockchainSyncState.findOne({
            contractName: this.contractName,
        }).lean();

        return syncState?.lastProcessedBlock ?? 0;
    }

    async updateLastProcessedBlock(blockNumber) {
        await updateProgress({
            contractName: this.contractName,
            contractAddress: this.contractAddress,
            lastProcessedBlock: blockNumber,
            status: "syncing",
        });
    }
}