import { ethers } from "ethers";

import * as contributionRepo from "../../repositories/contribution.repo.js";
import { persistLogsFromReceipt } from "../blockchain/core/receiptChainLog.js";
import { EventQueue } from "../blockchain/processors/eventQueue.js";
import { getFund, provider } from "../blockchain/index.js";

const AUTO_REFUND_WAIT_CONFIRMATIONS = Math.max(
  1,
  Number(process.env.AUTO_CONTRIBUTION_REFUND_WAIT_CONFIRMATIONS || 1),
);

const autoContributionRefundQueue = new EventQueue({
  name: "AutoContributionRefundQueue",
  concurrency: 1,
});
autoContributionRefundQueue.start();

const queuedEventKeys = new Set();

function isAutoContributionRefundEnabled() {
  const raw = String(
    process.env.AUTO_CONTRIBUTION_REFUND_ENABLED ?? "true",
  ).trim().toLowerCase();

  return !["0", "false", "off", "no"].includes(raw);
}

function getBackendSigner() {
  const privateKey = process.env.BACKEND_SIGNER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "Missing BACKEND_SIGNER_PRIVATE_KEY for automatic contribution refunds",
    );
  }

  return new ethers.Wallet(privateKey, provider);
}

function toEventKey(eventDoc) {
  if (eventDoc?._id) return String(eventDoc._id);
  if (eventDoc?.contractEventId) return `chain:${eventDoc.contractEventId}`;
  return null;
}

async function persistRefundReceipt(receipt, logger) {
  const fundContract = getFund();
  const fundAddress = await fundContract.getAddress();

  await persistLogsFromReceipt({
    receipt,
    contract: fundContract,
    contractName: "Fund",
    contractAddress: fundAddress,
  });

  logger.info?.(
    `[auto-contribution-refund] persisted receipt logs for tx ${receipt?.hash || "unknown"}`,
  );
}

export async function autoRefundContributionsForEvent(eventDoc, options = {}) {
  const logger = options.logger || console;

  if (!isAutoContributionRefundEnabled()) {
    return {
      skipped: true,
      reason: "disabled",
    };
  }

  if (!eventDoc?._id) {
    return {
      skipped: true,
      reason: "missing_event_id",
    };
  }

  if (!eventDoc?.contractEventId) {
    return {
      skipped: true,
      reason: "missing_contract_event_id",
    };
  }

  const repositories = options.repositories || {};
  const refundableContributors =
    await (repositories.contributionRepo || contributionRepo)
      .findRefundableContributors(eventDoc._id);

  if (!refundableContributors.length) {
    return {
      eventId: String(eventDoc._id),
      inspected: 0,
      refunded: 0,
      failed: 0,
      skipped: 0,
    };
  }

  const signer = options.signer || getBackendSigner();
  const fundContract = options.fundContract || getFund();
  const fundWithSigner =
    typeof fundContract.connect === "function"
      ? fundContract.connect(signer)
      : fundContract;

  const chainEventId = BigInt(eventDoc.contractEventId);
  const result = {
    eventId: String(eventDoc._id),
    inspected: 0,
    refunded: 0,
    failed: 0,
    skipped: 0,
  };

  for (const contributor of refundableContributors) {
    if (!contributor) continue;

    result.inspected += 1;

    try {
      const tx = await fundWithSigner.claimContributionRefundFor(
        chainEventId,
        contributor,
      );
      const receipt = await tx.wait(AUTO_REFUND_WAIT_CONFIRMATIONS);

      if (!receipt || Number(receipt.status) !== 1) {
        throw new Error("Automatic contribution refund transaction failed on-chain");
      }

      result.refunded += 1;

      try {
        await persistRefundReceipt(receipt, logger);
      } catch (error) {
        logger.error?.(
          `[auto-contribution-refund] failed to persist receipt for contributor ${contributor}: ${error?.message || error}`,
        );
      }

      logger.info?.(
        `[auto-contribution-refund] refunded contributor ${contributor} for event ${eventDoc.contractEventId} in tx ${tx.hash}`,
      );
    } catch (error) {
      result.failed += 1;
      logger.error?.(
        `[auto-contribution-refund] failed contributor ${contributor} for event ${eventDoc.contractEventId}: ${error?.message || error}`,
      );
    }
  }

  return result;
}

export function scheduleAutoContributionRefundForEvent(eventDoc, options = {}) {
  const logger = options.logger || console;
  const eventKey = toEventKey(eventDoc);

  if (!isAutoContributionRefundEnabled() || !eventKey) {
    return null;
  }

  if (queuedEventKeys.has(eventKey)) {
    return null;
  }

  queuedEventKeys.add(eventKey);

  const task = autoContributionRefundQueue.enqueue(async () => {
    try {
      return await autoRefundContributionsForEvent(eventDoc, options);
    } finally {
      queuedEventKeys.delete(eventKey);
    }
  });

  task.catch((error) => {
    logger.error?.(
      `[auto-contribution-refund] event ${eventKey} crashed: ${error?.message || error}`,
    );
  });

  return task;
}

export function resetAutoContributionRefundQueueForTests() {
  queuedEventKeys.clear();
  autoContributionRefundQueue.clear();
}
