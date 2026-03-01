import { ChainLog } from "../../../models/ChainLog.js";
import { TicketEvent } from "../../../models/TicketEvent.js";
import { TicketStats } from "../../../models/TicketStats.js";

import { provider } from "../core/provider.js";
import { getTicket } from "../core/contracts/index.js";
import {
	getOrInitSyncState,
	markError,
	markSynced,
	markSyncing,
	updateProgress,
} from "../core/blockTracker.js";
import {
	getNumberEnv,
	planReorgSafeSync,
	readReorgPolicyFromEnv,
} from "../sync/reorgPolicy.js";

const CONTRACT_NAME = "Ticket";
const PROCESSOR_NAME = "TicketProcessor";

function toStringId(value) {
	if (value === undefined || value === null) return undefined;
	return typeof value === "string" ? value : String(value);
}

function lowerAddress(value) {
	if (!value) return undefined;
	return String(value).toLowerCase();
}

function safeBigInt(value) {
	if (value === undefined || value === null || value === "") return 0n;
	try {
		return BigInt(value);
	} catch {
		return 0n;
	}
}

function mapChainLogToTicketEventDoc(chainLog, contractAddressLower) {
	const eventName = chainLog.eventName || "Unknown";
	const args = chainLog.args || {};

	const base = {
		contractAddress: contractAddressLower,
		blockNumber: chainLog.blockNumber,
		blockHash: chainLog.blockHash,
		transactionHash: chainLog.transactionHash,
		transactionIndex: chainLog.transactionIndex,
		logIndex: chainLog.logIndex,
		eventName,
		rawArgs: args,
	};

	switch (eventName) {
		case "TicketMintedBatch": {
			const eventId = toStringId(args.eventId);
			const ticketIds = Array.isArray(args.ticketIds)
				? args.ticketIds.map(toStringId).filter(Boolean)
				: undefined;
			return {
				...base,
				eventId,
				organizer: lowerAddress(args.to),
				ticketIds,
				priceWei: toStringId(args.price),
				ticketType:
					args.ticketType !== undefined && args.ticketType !== null
						? Number(args.ticketType)
						: undefined,
			};
		}

		case "TicketPurchased": {
			return {
				...base,
				eventId: toStringId(args.eventId),
				tokenId: toStringId(args.tokenId),
				buyer: lowerAddress(args.buyer),
				priceWei: toStringId(args.price),
			};
		}

		case "TicketUsed": {
			return {
				...base,
				eventId: toStringId(args.eventId),
				tokenId: toStringId(args.tokenId),
				owner: lowerAddress(args.owner),
				verifier: lowerAddress(args.verifier),
				usedAt: toStringId(args.usedAt),
			};
		}

		case "TicketExpired": {
			return {
				...base,
				eventId: toStringId(args.eventId),
				tokenId: toStringId(args.tokenId),
			};
		}

		case "TicketRefunded": {
			return {
				...base,
				eventId: toStringId(args.eventId),
				tokenId: toStringId(args.tokenId),
				owner: lowerAddress(args.owner),
				refundAmountWei: toStringId(args.refundAmount),
			};
		}

		case "FundContractSet": {
			return {
				...base,
				to: lowerAddress(args.fund),
			};
		}

		case "Transfer": {
			return {
				...base,
				tokenId: toStringId(args.tokenId),
				from: lowerAddress(args.from),
				to: lowerAddress(args.to),
			};
		}

		default:
			return base;
	}
}

async function deleteDerivedEventsInRange(contractAddressLower, fromBlock, toBlock) {
	await TicketEvent.deleteMany({
		contractAddress: contractAddressLower,
		blockNumber: { $gte: fromBlock, $lte: toBlock },
	});
}

async function rebuildStatsForEventIds(contractAddressLower, eventIds) {
	const uniqueEventIds = Array.from(
		new Set(eventIds.map(toStringId).filter(Boolean))
	);
	if (uniqueEventIds.length === 0) return;

	for (const eventId of uniqueEventIds) {
		const mintedDocs = await TicketEvent.find({
			contractAddress: contractAddressLower,
			eventId,
			eventName: "TicketMintedBatch",
		})
			.select({ ticketIds: 1 })
			.lean();
		const totalMinted = mintedDocs.reduce(
			(sum, d) => sum + (Array.isArray(d.ticketIds) ? d.ticketIds.length : 0),
			0
		);

		const totalSold = await TicketEvent.countDocuments({
			contractAddress: contractAddressLower,
			eventId,
			eventName: "TicketPurchased",
		});

		const totalUsed = await TicketEvent.countDocuments({
			contractAddress: contractAddressLower,
			eventId,
			eventName: "TicketUsed",
		});

		const totalExpired = await TicketEvent.countDocuments({
			contractAddress: contractAddressLower,
			eventId,
			eventName: "TicketExpired",
		});

		const totalRefunded = await TicketEvent.countDocuments({
			contractAddress: contractAddressLower,
			eventId,
			eventName: "TicketRefunded",
		});

		const purchasedDocs = await TicketEvent.find({
			contractAddress: contractAddressLower,
			eventId,
			eventName: "TicketPurchased",
		})
			.select({ priceWei: 1 })
			.lean();

		const totalRevenueWei = purchasedDocs
			.reduce((sum, d) => sum + safeBigInt(d.priceWei), 0n)
			.toString();

		await TicketStats.updateOne(
			{ contractAddress: contractAddressLower, eventId },
			{
				$set: {
					totalMinted,
					totalSold,
					totalUsed,
					totalExpired,
					totalRefunded,
					totalRevenueWei,
					lastRebuiltAt: new Date(),
				},
			},
			{ upsert: true }
		);
	}
}

export async function processTicketLogsOnce() {
	const ticket = getTicket();
	const { confirmations, reorgBuffer, chunkSize } = readReorgPolicyFromEnv();
	const startBlock = getNumberEnv(
		"TICKET_PROCESSOR_START_BLOCK",
		getNumberEnv("TICKET_START_BLOCK", 0)
	);

	const contractAddress = await ticket.getAddress();
	const contractAddressLower = contractAddress.toLowerCase();

	const syncState = await getOrInitSyncState({
		contractName: PROCESSOR_NAME,
		contractAddress,
		startBlock,
	});

	const latest = await provider.getBlockNumber();
	const plan = planReorgSafeSync({
		latestBlock: latest,
		confirmations,
		startBlock,
		lastProcessedBlock: syncState.lastProcessedBlock,
		reorgBuffer,
	});

	const target = plan.targetBlock;
	if (!plan.shouldSync) {
		return { latest, target, processedTo: syncState.lastProcessedBlock };
	}

	const from = plan.fromBlock;

	await markSyncing(PROCESSOR_NAME);

	let currentFrom = from;
	while (currentFrom <= target) {
		const currentTo = Math.min(target, currentFrom + chunkSize - 1);

		// Reorg-safe: wipe derived docs in the rescan window.
		await deleteDerivedEventsInRange(contractAddressLower, currentFrom, currentTo);

		const logs = await ChainLog.find({
			contractName: CONTRACT_NAME,
			contractAddress: contractAddressLower,
			blockNumber: { $gte: currentFrom, $lte: currentTo },
			eventName: { $ne: null },
		})
			.sort({ blockNumber: 1, transactionIndex: 1, logIndex: 1 })
			.lean();

		const docs = logs.map((l) =>
			mapChainLogToTicketEventDoc(l, contractAddressLower)
		);

		if (docs.length > 0) {
			await TicketEvent.insertMany(docs, { ordered: false });
			const affectedEventIds = docs.map((d) => d.eventId).filter(Boolean);
			await rebuildStatsForEventIds(contractAddressLower, affectedEventIds);
		}

		await updateProgress({
			contractName: PROCESSOR_NAME,
			contractAddress,
			lastProcessedBlock: currentTo,
			status: "syncing",
		});

		currentFrom = currentTo + 1;
	}

	await markSynced(PROCESSOR_NAME);
	return { latest, target, processedTo: target };
}

export async function runTicketProcessorLoop() {
	const intervalMs = getNumberEnv(
		"CHAIN_PROCESS_INTERVAL_MS",
		getNumberEnv("CHAIN_SYNC_INTERVAL_MS", 10_000)
	);

	// eslint-disable-next-line no-constant-condition
	while (true) {
		try {
			await processTicketLogsOnce();
		} catch (err) {
			await markError(PROCESSOR_NAME, err);

			// eslint-disable-next-line no-console
			console.error("Ticket processor error:", err);
		}

		await new Promise((r) => setTimeout(r, intervalMs));
	}
}

