import logger from "../../config/logger.js";
import * as eventRepo from "../../repositories/event.repo.js";
import * as ticketRepo from "../../repositories/ticket.repo.js";
import { updateEventStatus } from "../admin/admin.service.js";
import { getFund } from "../blockchain/index.js";

let lifecycleTimer = null;
let tickInFlight = null;

const queuedEventKeys = new Set();
let cachedActiveFundAddress = null;

function normalizeAddress(value) {
  return value ? String(value).toLowerCase() : null;
}

async function getActiveFundAddress() {
  if (cachedActiveFundAddress) {
    return cachedActiveFundAddress;
  }

  const configuredFundAddress = normalizeAddress(process.env.FUND_ADDRESS);
  if (configuredFundAddress) {
    cachedActiveFundAddress = configuredFundAddress;
    return cachedActiveFundAddress;
  }

  const fund = getFund();
  cachedActiveFundAddress = normalizeAddress(await fund.getAddress());
  return cachedActiveFundAddress;
}

async function shouldSkipForFundDeploymentMismatch(
  eventDoc,
  scopedLogger,
  options = {},
) {
  const eventFundAddress = normalizeAddress(eventDoc?.fundContractAddress);
  if (!eventFundAddress) {
    return null;
  }

  const activeFundAddress =
    normalizeAddress(options.activeFundAddress) || (await getActiveFundAddress());

  if (!activeFundAddress || eventFundAddress === activeFundAddress) {
    return null;
  }

  scopedLogger.warn(
    `[auto-lifecycle] skipping event ${eventDoc._id}: event uses historical Fund deployment ${eventFundAddress}, active backend Fund is ${activeFundAddress}`,
  );

  return {
    skipped: true,
    reason: "historical_fund_deployment",
    eventFundAddress,
    activeFundAddress,
  };
}

function isAutoLifecycleEnabled() {
  const raw = String(
    process.env.AUTO_EVENT_LIFECYCLE_ENABLED ?? "true",
  ).trim().toLowerCase();

  return !["0", "false", "off", "no"].includes(raw);
}

function getTickIntervalMs() {
  const raw = Number(process.env.AUTO_EVENT_LIFECYCLE_INTERVAL_MS ?? 30_000);
  if (!Number.isFinite(raw) || raw <= 0) return 30_000;
  return Math.floor(raw);
}

function getScanLimit() {
  const raw = Number(process.env.AUTO_EVENT_LIFECYCLE_SCAN_LIMIT ?? 50);
  if (!Number.isFinite(raw) || raw <= 0) return 50;
  return Math.floor(raw);
}

function getDefaultTicketType() {
  const raw = Number(process.env.AUTO_TICKETING_DEFAULT_TYPE ?? 0);
  if (!Number.isInteger(raw) || raw < 0 || raw > 255) return 0;
  return raw;
}

function getTicketSalesThresholdPercent(eventDoc) {
  const raw = Number(eventDoc?.ticketUsageThreshold ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw;
}

function getTicketSalesThresholdCount(eventDoc) {
  const raw = Number(eventDoc?.usedThreshold ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.floor(raw);
}

function toEventKey(eventDoc) {
  if (eventDoc?._id) return String(eventDoc._id);
  if (eventDoc?.contractEventId) return `chain:${eventDoc.contractEventId}`;
  return null;
}

async function scheduleLifecycleTask(eventDoc, worker, options = {}) {
  const eventKey = toEventKey(eventDoc);
  if (!eventKey) {
    return {
      skipped: true,
      reason: "missing_event_key",
    };
  }

  if (queuedEventKeys.has(eventKey)) {
    return {
      skipped: true,
      reason: "already_queued",
    };
  }

  queuedEventKeys.add(eventKey);

  try {
    return await worker(eventDoc, options);
  } finally {
    queuedEventKeys.delete(eventKey);
  }
}

export async function autoFinalizeFundingDeadline(eventDoc, options = {}) {
  const scopedLogger = options.logger || logger;
  const repositories = options.repositories || {};
  const mismatch = await shouldSkipForFundDeploymentMismatch(
    eventDoc,
    scopedLogger,
    options,
  );
  if (mismatch) return mismatch;

  if (!eventDoc?._id) {
    return {
      skipped: true,
      reason: "missing_event_id",
    };
  }

  const result = await updateEventStatus(
    String(eventDoc._id),
    "funded",
    {},
    repositories,
  );

  scopedLogger.info(
    `[auto-lifecycle] finalized funding for event ${eventDoc._id} -> ${result?.status || "unknown"}`,
  );

  return {
    eventId: String(eventDoc._id),
    status: result?.status || null,
  };
}

export async function autoStartTicketing(eventDoc, options = {}) {
  const scopedLogger = options.logger || logger;
  const repositories = options.repositories || {};
  const ticketRepository = repositories.ticketRepo || ticketRepo;
  const mismatch = await shouldSkipForFundDeploymentMismatch(
    eventDoc,
    scopedLogger,
    options,
  );
  if (mismatch) return mismatch;

  if (!eventDoc?._id) {
    return {
      skipped: true,
      reason: "missing_event_id",
    };
  }

  const maxTickets = Number(eventDoc.maxTickets ?? eventDoc.totalTickets ?? 0);
  if (!Number.isInteger(maxTickets) || maxTickets <= 0) {
    return {
      skipped: true,
      reason: "invalid_max_tickets",
    };
  }

  const mintedCount = await ticketRepository.countTickets({
    eventId: eventDoc._id,
  });
  const remaining = maxTickets - mintedCount;

  if (remaining <= 0) {
    scopedLogger.warn(
      `[auto-lifecycle] skipping ticketing for event ${eventDoc._id}: no tickets left to mint`,
    );
    return {
      skipped: true,
      reason: "no_remaining_tickets",
      mintedCount,
      maxTickets,
    };
  }

  const result = await updateEventStatus(
    String(eventDoc._id),
    "ticketing",
    {
      quantity: remaining,
      ticketType: getDefaultTicketType(),
    },
    repositories,
  );

  scopedLogger.info(
    `[auto-lifecycle] started ticketing for event ${eventDoc._id} with ${remaining} ticket(s)`,
  );

  return {
    eventId: String(eventDoc._id),
    status: result?.status || null,
    mintedQuantity: remaining,
  };
}

export async function autoResolveTicketingOutcome(eventDoc, options = {}) {
  const scopedLogger = options.logger || logger;
  const repositories = options.repositories || {};
  const ticketRepository = repositories.ticketRepo || ticketRepo;
  const mismatch = await shouldSkipForFundDeploymentMismatch(
    eventDoc,
    scopedLogger,
    options,
  );
  if (mismatch) return mismatch;

  if (!eventDoc?._id) {
    return {
      skipped: true,
      reason: "missing_event_id",
    };
  }

  const maxTickets = Number(eventDoc.maxTickets ?? eventDoc.totalTickets ?? 0);
  if (!Number.isInteger(maxTickets) || maxTickets <= 0) {
    return {
      skipped: true,
      reason: "invalid_max_tickets",
    };
  }

  const soldFromEvent = Number(eventDoc.ticketsSold ?? 0);
  const soldFromTickets = await ticketRepository.countTickets({
    eventId: eventDoc._id,
    status: { $in: ["sold", "used", "expired", "refunded"] },
  });
  const soldCount = Math.max(soldFromEvent, soldFromTickets);

  const salesThresholdPercent = getTicketSalesThresholdPercent(eventDoc);
  const salesThresholdCount = getTicketSalesThresholdCount(eventDoc);
  const soldRatioPercent = maxTickets > 0 ? (soldCount / maxTickets) * 100 : 0;

  const thresholdMet =
    salesThresholdPercent > 0
      ? soldRatioPercent >= salesThresholdPercent
      : salesThresholdCount > 0
        ? soldCount >= salesThresholdCount
        : soldCount >= maxTickets;

  if (thresholdMet) {
    const updatedEvent = await (repositories.eventRepo || eventRepo).updateById(
      String(eventDoc._id),
      { status: "ongoing" },
    );

    scopedLogger.info(
      `[auto-lifecycle] moved event ${eventDoc._id} to ongoing after ticketing window with ${soldCount}/${maxTickets} ticket(s) sold`,
    );

    return {
      eventId: String(eventDoc._id),
      status: updatedEvent?.status || "ongoing",
      soldCount,
      maxTickets,
    };
  }

  const result = await updateEventStatus(
    String(eventDoc._id),
    "failed",
    {
      reason: "ticket_sales_not_met",
    },
    repositories,
  );

  scopedLogger.info(
    `[auto-lifecycle] failed event ${eventDoc._id} after ticketing window with ${soldCount}/${maxTickets} ticket(s) sold`,
  );

  return {
    eventId: String(eventDoc._id),
    status: result?.status || null,
    soldCount,
    maxTickets,
  };
}

export async function runAutoEventLifecycleTick(options = {}) {
  if (!isAutoLifecycleEnabled()) {
    return {
      skipped: true,
      reason: "disabled",
    };
  }

  if (tickInFlight) {
    return tickInFlight;
  }

  const scopedLogger = options.logger || logger;
  const repositories = options.repositories || {};
  const eventRepository = repositories.eventRepo || eventRepo;
  const now = options.now instanceof Date ? options.now : new Date();
  const scanLimit = options.scanLimit ?? getScanLimit();

  tickInFlight = (async () => {
    const activeFundAddress =
      normalizeAddress(options.activeFundAddress) || (await getActiveFundAddress());
    const scopedOptions = {
      ...options,
      activeFundAddress,
    };

    const fundingCandidates =
      await eventRepository.findDueFundingFinalizationEvents(now, scanLimit);
    const fundingResults = [];

    for (const eventDoc of fundingCandidates) {
      try {
        fundingResults.push(
          await scheduleLifecycleTask(
            eventDoc,
            autoFinalizeFundingDeadline,
            scopedOptions,
          ),
        );
      } catch (error) {
        fundingResults.push({
          eventId: String(eventDoc?._id || ""),
          failed: true,
          error: error?.message || String(error),
        });
        scopedLogger.error(
          `[auto-lifecycle] funding finalization failed for event ${eventDoc?._id}: ${error?.message || error}`,
        );
      }
    }

    const ticketingCandidates =
      await eventRepository.findDueTicketingStartEvents(now, scanLimit);
    const ticketingResults = [];

    for (const eventDoc of ticketingCandidates) {
      try {
        ticketingResults.push(
          await scheduleLifecycleTask(
            eventDoc,
            autoStartTicketing,
            scopedOptions,
          ),
        );
      } catch (error) {
        ticketingResults.push({
          eventId: String(eventDoc?._id || ""),
          failed: true,
          error: error?.message || String(error),
        });
        scopedLogger.error(
          `[auto-lifecycle] ticketing start failed for event ${eventDoc?._id}: ${error?.message || error}`,
        );
      }
    }

    const ticketingResolutionCandidates =
      await eventRepository.findDueTicketingResolutionEvents(now, scanLimit);
    const ticketingResolutionResults = [];

    for (const eventDoc of ticketingResolutionCandidates) {
      try {
        ticketingResolutionResults.push(
          await scheduleLifecycleTask(
            eventDoc,
            autoResolveTicketingOutcome,
            scopedOptions,
          ),
        );
      } catch (error) {
        ticketingResolutionResults.push({
          eventId: String(eventDoc?._id || ""),
          failed: true,
          error: error?.message || String(error),
        });
        scopedLogger.error(
          `[auto-lifecycle] ticketing resolution failed for event ${eventDoc?._id}: ${error?.message || error}`,
        );
      }
    }

    return {
      fundingChecked: fundingCandidates.length,
      ticketingChecked: ticketingCandidates.length,
      ticketingResolutionChecked: ticketingResolutionCandidates.length,
      fundingResults,
      ticketingResults,
      ticketingResolutionResults,
    };
  })().finally(() => {
    tickInFlight = null;
  });

  return tickInFlight;
}

export function startAutoEventLifecycleService(options = {}) {
  const scopedLogger = options.logger || logger;

  if (!isAutoLifecycleEnabled()) {
    scopedLogger.info("[auto-lifecycle] disabled by configuration");
    return null;
  }

  if (lifecycleTimer) {
    return lifecycleTimer;
  }

  const tick = async () => {
    try {
      await runAutoEventLifecycleTick(options);
    } catch (error) {
      scopedLogger.error(
        `[auto-lifecycle] tick failed: ${error?.message || error}`,
      );
    }
  };

  lifecycleTimer = setInterval(() => {
    void tick();
  }, getTickIntervalMs());

  void tick();

  scopedLogger.info(
    `[auto-lifecycle] started with interval ${getTickIntervalMs()}ms`,
  );

  return lifecycleTimer;
}

export function stopAutoEventLifecycleService() {
  if (lifecycleTimer) {
    clearInterval(lifecycleTimer);
    lifecycleTimer = null;
  }
}

export function resetAutoEventLifecycleServiceForTests() {
  stopAutoEventLifecycleService();
  queuedEventKeys.clear();
  tickInFlight = null;
  cachedActiveFundAddress = null;
}
