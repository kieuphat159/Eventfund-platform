import { scheduleAutoRefundForCancelledEvent } from "../tickets/autoRefund.service.js";
import { scheduleAutoContributionRefundForEvent } from "./autoContributionRefund.service.js";

function isTerminalRefundStatus(status) {
  return status === "cancelled" || status === "failed";
}

export function scheduleAutoRefundsForTerminalEvent(eventDoc, options = {}) {
  const status = String(eventDoc?.status || "").toLowerCase();
  if (!eventDoc?._id || !eventDoc?.contractEventId) {
    return null;
  }

  if (!isTerminalRefundStatus(status)) {
    return null;
  }

  const ticketRefundTask = scheduleAutoRefundForCancelledEvent(eventDoc, options);
  const contributionRefundTask = scheduleAutoContributionRefundForEvent(
    eventDoc,
    options,
  );

  return {
    ticketRefundTask,
    contributionRefundTask,
  };
}
