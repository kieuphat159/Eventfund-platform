import { jest } from "@jest/globals";

const mockScheduleAutoRefundForCancelledEvent = jest.fn();
const mockScheduleAutoContributionRefundForEvent = jest.fn();

jest.unstable_mockModule("../../../services/tickets/autoRefund.service.js", () => ({
  scheduleAutoRefundForCancelledEvent: mockScheduleAutoRefundForCancelledEvent,
}));

jest.unstable_mockModule("../../../services/events/autoContributionRefund.service.js", () => ({
  scheduleAutoContributionRefundForEvent: mockScheduleAutoContributionRefundForEvent,
}));

const {
  scheduleAutoRefundsForTerminalEvent,
} = await import("../../../services/events/terminalRefunds.service.js");

describe("terminalRefunds.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("schedules both contribution and ticket refunds for cancelled events", () => {
    const eventDoc = {
      _id: "evt-1",
      contractEventId: "101",
      status: "cancelled",
    };

    const result = scheduleAutoRefundsForTerminalEvent(eventDoc, {
      logger: console,
    });

    expect(mockScheduleAutoRefundForCancelledEvent).toHaveBeenCalledWith(
      eventDoc,
      expect.objectContaining({ logger: console }),
    );
    expect(mockScheduleAutoContributionRefundForEvent).toHaveBeenCalledWith(
      eventDoc,
      expect.objectContaining({ logger: console }),
    );
    expect(result).toEqual({
      ticketRefundTask: undefined,
      contributionRefundTask: undefined,
    });
  });

  test("ignores non-terminal statuses", () => {
    const result = scheduleAutoRefundsForTerminalEvent({
      _id: "evt-2",
      contractEventId: "102",
      status: "ongoing",
    });

    expect(result).toBeNull();
    expect(mockScheduleAutoRefundForCancelledEvent).not.toHaveBeenCalled();
    expect(mockScheduleAutoContributionRefundForEvent).not.toHaveBeenCalled();
  });
});
