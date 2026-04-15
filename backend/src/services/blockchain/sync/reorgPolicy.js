function toFiniteNumber(value) {
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? n : undefined;
}

function assertNonNegativeInteger(name, value) {
	const n = toFiniteNumber(value);
	if (n === undefined || !Number.isInteger(n) || n < 0) {
		throw new Error(`Invalid ${name}: ${value}`);
	}
	return n;
}

function assertPositiveInteger(name, value) {
	const n = toFiniteNumber(value);
	if (n === undefined || !Number.isInteger(n) || n <= 0) {
		throw new Error(`Invalid ${name}: ${value}`);
	}
	return n;
}

export function getNumberEnv(name, defaultValue) {
	const raw = process.env[name];
	if (raw === undefined || raw === "") return defaultValue;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) {
		throw new Error(`Invalid number env ${name}=${raw}`);
	}
	return parsed;
}

/**
 * Read common chain sync settings from env.
 *
 * Defaults match the indexers in this repo.
 */
export function readReorgPolicyFromEnv({
	confirmationsEnv = "CHAIN_CONFIRMATIONS",
	reorgBufferEnv = "REORG_BUFFER_BLOCKS",
	chunkSizeEnv = "CHAIN_LOG_CHUNK_SIZE",
	defaults = { confirmations: 12, reorgBuffer: 12, chunkSize: 10 },
} = {}) {
	const confirmations = assertNonNegativeInteger(
		"confirmations",
		getNumberEnv(confirmationsEnv, defaults.confirmations)
	);
	const reorgBuffer = assertNonNegativeInteger(
		"reorgBuffer",
		getNumberEnv(reorgBufferEnv, defaults.reorgBuffer)
	);
	const chunkSize = assertPositiveInteger(
		"chunkSize",
		getNumberEnv(chunkSizeEnv, defaults.chunkSize)
	);

	return { confirmations, reorgBuffer, chunkSize };
}

/**
 * Latest safe block to index given confirmation requirement.
 */
export function computeTargetBlock(latestBlock, confirmations) {
	const latest = assertNonNegativeInteger("latestBlock", latestBlock);
	const conf = assertNonNegativeInteger("confirmations", confirmations);
	return Math.max(0, latest - conf);
}

/**
 * Start block for rescan window.
 *
 * Strategy: always rewind `reorgBuffer - 1` blocks from lastProcessedBlock
 * (inclusive), but never go below `startBlock`.
 */
export function computeRescanFromBlock({
	startBlock = 0,
	lastProcessedBlock = 0,
	reorgBuffer = 0,
}) {
	const start = assertNonNegativeInteger("startBlock", startBlock);
	const last = assertNonNegativeInteger("lastProcessedBlock", lastProcessedBlock);
	const buffer = assertNonNegativeInteger("reorgBuffer", reorgBuffer);

	// If buffer = 0, there is no rewind; continue from last + 1.
	if (buffer === 0) return Math.max(start, last + 1);

	// Example: last=100, buffer=12 => from=89 (i.e. 100-12+1)
	const from = Math.max(0, last - buffer + 1);
	return Math.max(start, from);
}

/**
 * Compute a basic indexing plan that is reorg-safe.
 *
 * Returns a compact plan that indexers can follow:
 * - `targetBlock`: latest safe block (latest - confirmations)
 * - `fromBlock`: where to start fetching logs for this run
 * - `toBlock`: inclusive end block (same as targetBlock)
 */
export function planReorgSafeSync({
	latestBlock,
	confirmations,
	startBlock = 0,
	lastProcessedBlock = 0,
	reorgBuffer = 0,
}) {
	const targetBlock = computeTargetBlock(latestBlock, confirmations);

	if (targetBlock <= 0) {
		return {
			latestBlock: assertNonNegativeInteger("latestBlock", latestBlock),
			targetBlock,
			fromBlock: assertNonNegativeInteger("lastProcessedBlock", lastProcessedBlock),
			toBlock: targetBlock,
			shouldSync: false,
			reason: "chain_not_ready",
		};
	}

	const fromBlock = computeRescanFromBlock({
		startBlock,
		lastProcessedBlock,
		reorgBuffer,
	});

	if (fromBlock > targetBlock) {
		return {
			latestBlock: assertNonNegativeInteger("latestBlock", latestBlock),
			targetBlock,
			fromBlock,
			toBlock: targetBlock,
			shouldSync: false,
			reason: "already_synced",
		};
	}

	return {
		latestBlock: assertNonNegativeInteger("latestBlock", latestBlock),
		targetBlock,
		fromBlock,
		toBlock: targetBlock,
		shouldSync: true,
		reason: "sync",
	};
}

export function createReorgPolicy({ confirmations = 12, reorgBuffer = 12 } = {}) {
	const conf = assertNonNegativeInteger("confirmations", confirmations);
	const buffer = assertNonNegativeInteger("reorgBuffer", reorgBuffer);

	return {
		confirmations: conf,
		reorgBuffer: buffer,
		computeTargetBlock: (latestBlock) => computeTargetBlock(latestBlock, conf),
		computeRescanFromBlock: ({ startBlock = 0, lastProcessedBlock = 0 } = {}) =>
			computeRescanFromBlock({ startBlock, lastProcessedBlock, reorgBuffer: buffer }),
		plan: ({ latestBlock, startBlock = 0, lastProcessedBlock = 0 } = {}) =>
			planReorgSafeSync({
				latestBlock,
				confirmations: conf,
				startBlock,
				lastProcessedBlock,
				reorgBuffer: buffer,
			}),
	};
}

export const defaultReorgPolicy = createReorgPolicy();
export default defaultReorgPolicy;

