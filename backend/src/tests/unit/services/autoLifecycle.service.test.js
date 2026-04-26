import { jest } from "@jest/globals";

const mockUpdateEventStatus = jest.fn();
const mockFundGetAddress = jest.fn();
const mockGetFund = jest.fn(() => ({
  getAddress: mockFundGetAddress,
}));

jest.unstable_mockModule("../../../services/admin/admin.service.js", () => ({
  updateEventStatus: mockUpdateEventStatus,
}));

jest.unstable_mockModule("../../../services/blockchain/index.js", () => ({
  getFund: mockGetFund,
}));

const {
  autoFinalizeFundingDeadline,
  autoStartTicketing,
  autoResolveTicketingOutcome,
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
    delete process.env.AUTO_TICKETING_DEFAULT_TYPE;
    process.env.FUND_ADDRESS = "0x6ae84B87203186108395F46aBcAE4cFf44ae0Bd7";
    mockFundGetAddress.mockResolvedValue(
      "0x6ae84B87203186108395F46aBcAE4cFf44ae0Bd7",
    );
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
    mockUpdateEventStatus.mockResolvedValue({
      _id: "evt-ticketing",
      status: "ticketing",
    });

    const result = await autoStartTicketing(
      {
        _id: "evt-ticketing",
        contractEventId: "202",
        maxTickets: 120,
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
          },
        ]),
        findDueTicketingResolutionEvents: jest.fn().mockResolvedValue([]),
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
});
