import { jest } from "@jest/globals";

const mockUpdateEventStatus = jest.fn();
const mockFundGetAddress = jest.fn();
const mockGetTicket = jest.fn();
const mockScheduleAutoRefundsForTerminalEvent = jest.fn();
const mockTicketContract = {
  getUsageStats: jest.fn(),
};
const mockGetFund = jest.fn(() => ({
  getAddress: mockFundGetAddress,
}));

jest.unstable_mockModule("../../../services/admin/admin.service.js", () => ({
  updateEventStatus: mockUpdateEventStatus,
}));

jest.unstable_mockModule("../../../services/blockchain/index.js", () => ({
  getFund: mockGetFund,
  getTicket: mockGetTicket,
}));

jest.unstable_mockModule("../../../services/events/terminalRefunds.service.js", () => ({
  scheduleAutoRefundsForTerminalEvent: mockScheduleAutoRefundsForTerminalEvent,
}));

const {
  autoFinalizeFundingDeadline,
  autoStartTicketing,
  autoResolveTicketingOutcome,
  autoResolveEndedEvent,
  resetAutoEventLifecycleServiceForTests,
  runAutoEventLifecycleTick,
} = await import("../../../services/events/autoLifecycle.service.js");

describe("autoLifecycle.service", () => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetAutoEventLifecycleServiceForTests();
    process.env.AUTO_EVENT_LIFECYCLE_ENABLED = "true";
    delete process.env.AUTO_EVENT_TICKETING_ENABLED;
    delete process.env.AUTO_TICKETING_DEFAULT_TYPE;
    process.env.FUND_ADDRESS = "0x6ae84B87203186108395F46aBcAE4cFf44ae0Bd7";
    mockFundGetAddress.mockResolvedValue(
      "0x6ae84B87203186108395F46aBcAE4cFf44ae0Bd7",
    );
    mockGetTicket.mockReturnValue(mockTicketContract);
    mockTicketContract.getUsageStats.mockReset();
    mockScheduleAutoRefundsForTerminalEvent.mockReset();
  });

  afterAll(() => {
    delete process.env.AUTO_EVENT_LIFECYCLE_ENABLED;
    delete process.env.AUTO_TICKETING_DEFAULT_TYPE;
    delete process.env.FUND_ADDRESS;
  });

  test("auto-finalizes overdue funding events through the existing admin transition", async () => {
    mockUpdateEventStatus.mockResolvedValue({
      _id: "evt-funding",
      status: "cancelled",
    });

    const result = await autoFinalizeFundingDeadline(
      {
        _id: "evt-funding",
        contractEventId: "101",
      },
      { logger },
    );

    expect(mockUpdateEventStatus).toHaveBeenCalledWith(
      "evt-funding",
      "funded",
      {},
      {},
    );
    expect(result).toEqual({
      eventId: "evt-funding",
      status: "cancelled",
    });
  });

  test("auto-starts ticketing with the remaining mint quantity", async () => {
    process.env.AUTO_EVENT_TICKETING_ENABLED = "true";
    mockUpdateEventStatus.mockResolvedValue({
      _id: "evt-ticketing",
      status: "ticketing",
    });

    const result = await autoStartTicketing(
      {
        _id: "evt-ticketing",
        contractEventId: "202",
        maxTickets: 120,
        ticketingStartAt: new Date("2026-04-26T09:00:00.000Z"),
      },
      {
        logger,
        repositories: {
          ticketRepo: {
            countTickets: jest.fn().mockResolvedValue(20),
          },
        },
      },
    );

    expect(mockUpdateEventStatus).toHaveBeenCalledWith(
      "evt-ticketing",
      "ticketing",
      {
        quantity: 100,
        ticketType: 0,
      },
      expect.objectContaining({
        ticketRepo: expect.any(Object),
      }),
    );
    expect(result).toEqual({
      eventId: "evt-ticketing",
      status: "ticketing",
      mintedQuantity: 100,
    });
  });

  test("skips auto-start ticketing when ticketingStartAt is missing", async () => {
    process.env.AUTO_EVENT_TICKETING_ENABLED = "true";
    const repositories = {
      eventRepo: {
        findDueFundingFinalizationEvents: jest.fn().mockResolvedValue([]),
        findDueTicketingStartEvents: jest.fn().mockResolvedValue([
          {
            _id: "evt-funding",
            contractEventId: "303",
            status: "funded",
            maxTickets: 50,
            ticketingStartAt: null,
          },
        ]),
        findDueTicketingResolutionEvents: jest.fn().mockResolvedValue([]),
        findDueEventSettlementEvents: jest.fn().mockResolvedValue([]),
      },
      ticketRepo: {
        countTickets: jest.fn(),
      },
    };

    const result = await runAutoEventLifecycleTick({
      logger,
      repositories,
      now: new Date("2026-04-26T10:00:00.000Z"),
      scanLimit: 10,
    });

    expect(mockUpdateEventStatus).not.toHaveBeenCalledWith(
      "evt-funding",
      "ticketing",
      expect.any(Object),
      expect.any(Object),
    );
    expect(result).toMatchObject({
      fundingChecked: 0,
      ticketingChecked: 1,
      ticketingResolutionChecked: 0,
      ticketingResults: [
        {
          skipped: true,
          reason: "missing_ticketing_start_at",
          eventId: "evt-funding",
        },
      ],
    });
  });

  test("skips auto-start ticketing for events bound to a historical fund deployment", async () => {
    const result = await autoStartTicketing(
      {
        _id: "evt-legacy",
        contractEventId: "999",
        fundContractAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        maxTickets: 10,
      },
      {
        logger,
        repositories: {
          ticketRepo: {
            countTickets: jest.fn(),
          },
        },
      },
    );

    expect(mockUpdateEventStatus).not.toHaveBeenCalled();
    expect(result).toEqual({
      skipped: true,
      reason: "historical_fund_deployment",
      eventFundAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      activeFundAddress: "0x6ae84b87203186108395f46abcae4cff44ae0bd7",
    });
  });

  test("tick finalizes funding first and then starts ticketing for due funded events", async () => {
    process.env.AUTO_EVENT_TICKETING_ENABLED = "true";
    const repositories = {
      eventRepo: {
        findDueFundingFinalizationEvents: jest.fn().mockResolvedValue([
          {
            _id: "evt-overdue",
            contractEventId: "301",
            status: "funding",
          },
        ]),
        findDueTicketingStartEvents: jest.fn().mockResolvedValue([
          {
            _id: "evt-funded",
            contractEventId: "302",
            status: "funded",
            maxTickets: 50,
            ticketingStartAt: new Date("2026-04-26T09:00:00.000Z"),
          },
        ]),
        findDueTicketingResolutionEvents: jest.fn().mockResolvedValue([]),
        findDueEventSettlementEvents: jest.fn().mockResolvedValue([]),
      },
      ticketRepo: {
        countTickets: jest.fn().mockResolvedValue(5),
      },
    };

    mockUpdateEventStatus
      .mockResolvedValueOnce({
        _id: "evt-overdue",
        status: "funded",
      })
      .mockResolvedValueOnce({
        _id: "evt-funded",
        status: "ticketing",
      });

    const result = await runAutoEventLifecycleTick({
      logger,
      repositories,
      now: new Date("2026-04-26T10:00:00.000Z"),
      scanLimit: 10,
    });

    expect(repositories.eventRepo.findDueFundingFinalizationEvents).toHaveBeenCalledWith(
      expect.any(Date),
      10,
    );
    expect(repositories.eventRepo.findDueTicketingStartEvents).toHaveBeenCalledWith(
      expect.any(Date),
      10,
    );
    expect(mockUpdateEventStatus).toHaveBeenNthCalledWith(
      1,
      "evt-overdue",
      "funded",
      {},
      repositories,
    );
    expect(mockUpdateEventStatus).toHaveBeenNthCalledWith(
      2,
      "evt-funded",
      "ticketing",
      {
        quantity: 45,
        ticketType: 0,
      },
      repositories,
    );
    expect(result).toMatchObject({
      fundingChecked: 1,
      ticketingChecked: 1,
      ticketingResolutionChecked: 0,
    });
  });

  test("tick also starts ticketing for due funding events so stale sync does not block ticketing", async () => {
    process.env.AUTO_EVENT_TICKETING_ENABLED = "true";
    const repositories = {
      eventRepo: {
        findDueFundingFinalizationEvents: jest.fn().mockResolvedValue([]),
        findDueTicketingStartEvents: jest.fn().mockResolvedValue([
          {
            _id: "evt-stale-funding",
            contractEventId: "303",
            status: "funding",
            maxTickets: 20,
            ticketingStartAt: new Date("2026-04-26T09:00:00.000Z"),
          },
        ]),
        findDueTicketingResolutionEvents: jest.fn().mockResolvedValue([]),
        findDueEventSettlementEvents: jest.fn().mockResolvedValue([]),
      },
      ticketRepo: {
        countTickets: jest.fn().mockResolvedValue(0),
      },
    };

    mockUpdateEventStatus.mockResolvedValue({
      _id: "evt-stale-funding",
      status: "ticketing",
    });

    const result = await runAutoEventLifecycleTick({
      logger,
      repositories,
      now: new Date("2026-04-26T10:00:00.000Z"),
      scanLimit: 10,
    });

    expect(mockUpdateEventStatus).toHaveBeenCalledWith(
      "evt-stale-funding",
      "ticketing",
      {
        quantity: 20,
        ticketType: 0,
      },
      repositories,
    );
    expect(result.ticketingChecked).toBe(1);
  });

  test("can disable auto-lifecycle explicitly", async () => {
    process.env.AUTO_EVENT_LIFECYCLE_ENABLED = "false";
    const repositories = {
      eventRepo: {
        findDueFundingFinalizationEvents: jest.fn().mockResolvedValue([]),
        findDueTicketingStartEvents: jest.fn().mockResolvedValue([
          {
            _id: "evt-funded",
            contractEventId: "302",
            status: "funded",
            maxTickets: 50,
            ticketingStartAt: new Date("2026-04-26T09:00:00.000Z"),
          },
        ]),
        findDueTicketingResolutionEvents: jest.fn().mockResolvedValue([]),
        findDueEventSettlementEvents: jest.fn().mockResolvedValue([]),
      },
      ticketRepo: {
        countTickets: jest.fn(),
      },
    };

    const result = await runAutoEventLifecycleTick({
      logger,
      repositories,
      now: new Date("2026-04-26T10:00:00.000Z"),
      scanLimit: 10,
    });

    expect(result).toEqual({
      skipped: true,
      reason: "disabled",
    });
    expect(mockUpdateEventStatus).not.toHaveBeenCalled();
  });

  test("auto-resolves ticketing to ongoing when sold threshold is met", async () => {
    const repositories = {
      eventRepo: {
        updateById: jest.fn().mockResolvedValue({
          _id: "evt-ticket-end",
          status: "ongoing",
        }),
      },
      ticketRepo: {
        countTickets: jest.fn().mockResolvedValue(80),
      },
    };

    const result = await autoResolveTicketingOutcome(
      {
        _id: "evt-ticket-end",
        contractEventId: "401",
        maxTickets: 100,
        ticketUsageThreshold: 75,
        ticketsSold: 80,
      },
      { logger, repositories },
    );

    expect(repositories.eventRepo.updateById).toHaveBeenCalledWith(
      "evt-ticket-end",
      { status: "ongoing" },
    );
    expect(mockUpdateEventStatus).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      eventId: "evt-ticket-end",
      status: "ongoing",
      soldCount: 80,
      maxTickets: 100,
    });
  });

  test("auto-resolves ticketing to failed when sold threshold is not met", async () => {
    mockUpdateEventStatus.mockResolvedValue({
      _id: "evt-failed",
      status: "failed",
    });

    const repositories = {
      eventRepo: {
        updateById: jest.fn(),
      },
      ticketRepo: {
        countTickets: jest.fn().mockResolvedValue(30),
      },
    };

    const result = await autoResolveTicketingOutcome(
      {
        _id: "evt-failed",
        contractEventId: "402",
        maxTickets: 100,
        ticketUsageThreshold: 50,
        ticketsSold: 30,
      },
      { logger, repositories },
    );

    expect(mockUpdateEventStatus).toHaveBeenCalledWith(
      "evt-failed",
      "failed",
      { reason: "ticket_sales_not_met" },
      repositories,
    );
    expect(result).toMatchObject({
      eventId: "evt-failed",
      status: "failed",
      soldCount: 30,
      maxTickets: 100,
    });
  });

  test("auto-completes ended ongoing events when usage reaches 36 percent", async () => {
    mockTicketContract.getUsageStats.mockResolvedValue([100n, 50n, 18n, 3600n]);
    mockUpdateEventStatus.mockResolvedValue({
      _id: "evt-ended-pass",
      status: "completed",
    });

    const result = await autoResolveEndedEvent(
      {
        _id: "evt-ended-pass",
        contractEventId: "777",
        status: "ongoing",
        endDate: new Date("2026-04-26T09:00:00.000Z"),
      },
      {
        logger,
        now: new Date("2026-04-26T10:00:00.000Z"),
        repositories: {},
      },
    );

    expect(mockTicketContract.getUsageStats).toHaveBeenCalledWith(777n);
    expect(mockUpdateEventStatus).toHaveBeenCalledWith(
      "evt-ended-pass",
      "completed",
      {},
      {},
    );
    expect(mockScheduleAutoRefundsForTerminalEvent).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      eventId: "evt-ended-pass",
      status: "completed",
      soldCount: 50,
      usedCount: 18,
      requiredUsed: 18,
    });
  });

  test("falls back to local completion when on-chain completion requires organizer authorization", async () => {
    mockTicketContract.getUsageStats.mockResolvedValue([100n, 50n, 18n, 3600n]);
    mockUpdateEventStatus.mockRejectedValue(
      new Error(
        "Organizer wallet signature required: Only the organizer can perform this on-chain action from the connected wallet.",
      ),
    );

    const eventRepo = {
      updateById: jest.fn().mockResolvedValue({
        _id: "evt-ended-fallback",
        status: "completed",
        completedAt: new Date("2026-04-26T10:05:00.000Z"),
      }),
    };

    const result = await autoResolveEndedEvent(
      {
        _id: "evt-ended-fallback",
        contractEventId: "778",
        status: "ongoing",
        endDate: new Date("2026-04-26T09:00:00.000Z"),
      },
      {
        logger,
        now: new Date("2026-04-26T10:00:00.000Z"),
        repositories: { eventRepo },
      },
    );

    expect(eventRepo.updateById).toHaveBeenCalledWith(
      "evt-ended-fallback",
      expect.objectContaining({
        status: "completed",
      }),
    );
    expect(mockScheduleAutoRefundsForTerminalEvent).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      eventId: "evt-ended-fallback",
      status: "completed",
      soldCount: 50,
      usedCount: 18,
      requiredUsed: 18,
      onChainCompletionPending: true,
    });
  });

  test("locally completes historical fund events instead of skipping them", async () => {
    mockTicketContract.getUsageStats.mockResolvedValue([100n, 50n, 18n, 3600n]);

    const eventRepo = {
      updateById: jest.fn().mockResolvedValue({
        _id: "evt-historical",
        status: "completed",
        completedAt: new Date("2026-04-26T10:05:00.000Z"),
      }),
    };

    const result = await autoResolveEndedEvent(
      {
        _id: "evt-historical",
        contractEventId: "778",
        status: "ongoing",
        endDate: new Date("2026-04-26T09:00:00.000Z"),
        fundContractAddress: "0xc0f3fba8360f34316c8f194d32f80e243508af60",
      },
      {
        logger,
        now: new Date("2026-04-26T10:00:00.000Z"),
        activeFundAddress: "0xf29c5f1b3b66a5cdecace4615a6fb3ff6f502d1b",
        repositories: { eventRepo },
      },
    );

    expect(eventRepo.updateById).toHaveBeenCalledWith(
      "evt-historical",
      expect.objectContaining({
        status: "completed",
      }),
    );
    expect(mockScheduleAutoRefundsForTerminalEvent).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      eventId: "evt-historical",
      status: "completed",
      soldCount: 50,
      usedCount: 18,
      requiredUsed: 18,
      onChainCompletionPending: true,
    });
  });

  test("auto-fails ended ongoing events below the 36 percent threshold and schedules refunds", async () => {
    mockTicketContract.getUsageStats.mockResolvedValue([100n, 50n, 17n, 3400n]);
    mockUpdateEventStatus.mockResolvedValue({
      _id: "evt-ended-fail",
      status: "failed",
    });

    const result = await autoResolveEndedEvent(
      {
        _id: "evt-ended-fail",
        contractEventId: "778",
        status: "ongoing",
        endDate: new Date("2026-04-26T09:00:00.000Z"),
      },
      {
        logger,
        now: new Date("2026-04-26T10:00:00.000Z"),
        repositories: {},
      },
    );

    expect(mockTicketContract.getUsageStats).toHaveBeenCalledWith(778n);
    expect(mockUpdateEventStatus).toHaveBeenCalledWith(
      "evt-ended-fail",
      "failed",
      { reason: "ticket_sales_not_met" },
      {},
    );
    expect(mockScheduleAutoRefundsForTerminalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
      expect.objectContaining({
        logger,
        repositories: {},
      }),
    );
    expect(result).toMatchObject({
      eventId: "evt-ended-fail",
      status: "failed",
      soldCount: 50,
      usedCount: 17,
      requiredUsed: 18,
    });
  });
});
