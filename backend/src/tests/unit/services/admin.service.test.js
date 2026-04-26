import { jest } from "@jest/globals";

const fundAddress = "0x3333333333333333333333333333333333333333";
const ticketAddress = "0x4444444444444444444444444444444444444444";

const mockFundWithSigner = {
  createEvent: jest.fn(),
  createEventWithInvestment: jest.fn(),
  finalizeFunding: jest.fn(),
  cancelEvent: jest.fn(),
  startTicketing: jest.fn(),
  setCompletedIfThresholdMet: jest.fn(),
};

const mockFund = {
  getAddress: jest.fn(),
  connect: jest.fn(() => mockFundWithSigner),
  interface: {
    parseLog: jest.fn(),
  },
};

const mockTicket = {
  getAddress: jest.fn(),
  interface: {
    parseLog: jest.fn(),
  },
};

const mockPersistLogsFromReceipt = jest.fn();
const mockGetFund = jest.fn(() => mockFund);
const mockGetTicket = jest.fn(() => mockTicket);

jest.unstable_mockModule("../../../services/blockchain/index.js", () => ({
  provider: {},
  getFund: mockGetFund,
  getTicket: mockGetTicket,
}));

jest.unstable_mockModule(
  "../../../services/blockchain/core/receiptChainLog.js",
  () => ({
    persistLogsFromReceipt: mockPersistLogsFromReceipt,
  }),
);

const { getEventInvestments, updateEventStatus } = await import(
  "../../../services/admin/admin.service.js"
);

describe("admin.service updateEventStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BACKEND_SIGNER_PRIVATE_KEY =
      "0x59c6995e998f97a5a0044966f0945382d7d8b6d2f6f6b7b85d3c7f3c6a7b1234";

    mockGetFund.mockReturnValue(mockFund);
    mockGetTicket.mockReturnValue(mockTicket);
    mockFund.getAddress.mockResolvedValue(fundAddress);
    mockFund.connect.mockReturnValue(mockFundWithSigner);
    mockTicket.getAddress.mockResolvedValue(ticketAddress);
    mockTicket.interface.parseLog.mockImplementation(() => {
      throw new Error("Unknown ticket log");
    });
    mockFund.interface.parseLog.mockImplementation((log) => {
      if (log.data === "0xcreated") {
        return {
          name: "EventCreated",
          args: {
            eventId: 9n,
            organizer: "0x1111111111111111111111111111111111111111",
            stakeAmount: 5n,
            minStakeRequired: 5n,
            fundingGoal: 0n,
            fundingDeadline: 0n,
          },
        };
      }

      if (log.data === "0xfinalized") {
        return {
          name: "FundingFinalized",
          args: {
            statusAfterFinalize: 2,
          },
        };
      }

      if (log.data === "0xticketing") {
        return {
          name: "TicketingStarted",
          args: {
            eventId: 9n,
          },
        };
      }

      if (log.data === "0xcancelled") {
        return {
          name: "EventCancelled",
          args: {
            reason: 2,
            ticketRefundsEnabled: true,
            refundPoolAmount: 100n,
          },
        };
      }

      throw new Error("Unknown log");
    });

    mockFundWithSigner.createEventWithInvestment.mockResolvedValue({
      wait: jest.fn().mockResolvedValue({
        status: 1,
        logs: [{ address: fundAddress, data: "0xcreated" }],
      }),
    });
    mockFundWithSigner.finalizeFunding.mockResolvedValue({
      wait: jest.fn().mockResolvedValue({
        status: 1,
        logs: [{ address: fundAddress, data: "0xfinalized" }],
      }),
    });
    mockFundWithSigner.startTicketing.mockResolvedValue({
      wait: jest.fn().mockResolvedValue({
        status: 1,
        logs: [{ address: fundAddress, data: "0xticketing" }],
      }),
    });
    mockFundWithSigner.cancelEvent.mockResolvedValue({
      wait: jest.fn().mockResolvedValue({
        status: 1,
        logs: [{ address: fundAddress, data: "0xcancelled" }],
      }),
    });
  });

  test("publishes zero-funding draft on-chain before admin starts ticketing", async () => {
    const draftEvent = {
      _id: "507f1f77bcf86cd799439011",
      title: "Zero funding draft",
      organizer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      status: "draft",
      fundingGoal: "0",
      minStakeRequired: "5",
      organizerStake: "5",
      ticketPrice: 1,
      totalTickets: 100,
      ticketTiers: [{ name: "General", price: 1, totalSupply: 100 }],
      startDate: new Date("2026-06-01T10:00:00.000Z").toISOString(),
    };

    const repository = {
      findById: jest.fn().mockResolvedValue(draftEvent),
      updateById: jest
        .fn()
        .mockResolvedValueOnce({
          ...draftEvent,
          contractEventId: "9",
          onChainOrganizer: "0x1111111111111111111111111111111111111111",
          status: "funded",
        })
        .mockResolvedValueOnce({
          ...draftEvent,
          contractEventId: "9",
          status: "ticketing",
        }),
    };

    const result = await updateEventStatus(
      draftEvent._id,
      "ticketing",
      { quantity: 10, ticketType: 0 },
      { eventRepo: repository },
    );

    expect(mockFundWithSigner.createEventWithInvestment).toHaveBeenCalledWith(
      0n,
      0n,
      5n,
      7000n,
      1n,
      100n,
      100n,
      false,
      { value: 5n },
    );
    expect(mockFundWithSigner.finalizeFunding).not.toHaveBeenCalled();
    expect(mockFundWithSigner.startTicketing).toHaveBeenCalledWith(9n, 0, 10n);
    expect(repository.updateById).toHaveBeenNthCalledWith(
      1,
      draftEvent._id,
      expect.objectContaining({
        contractEventId: "9",
        status: "funded",
      }),
    );
    expect(repository.updateById).toHaveBeenNthCalledWith(
      2,
      draftEvent._id,
      { status: "ticketing" },
    );
    expect(mockPersistLogsFromReceipt).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({
      contractEventId: "9",
      status: "ticketing",
    });
  });

  test("returns empty investments summary for self-funded event without investors", async () => {
    const eventId = "69e1a6a5aa888772b439325f";
    const repository = {
      findById: jest.fn().mockResolvedValue({
        _id: eventId,
        title: "Self-funded event",
        status: "funded",
        fundingGoal: "0",
        currentFunding: "0",
      }),
    };
    const shareRepository = {
      findByEvent: jest.fn().mockResolvedValue({
        docs: [],
        totalDocs: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      }),
    };

    const contributionFind = jest.spyOn((await import("../../../models/Contribution.model.js")).default, "find");
    contributionFind.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    const result = await getEventInvestments(
      eventId,
      { limit: 10, sort: "-contributionAmount" },
      { eventRepo: repository, shareRepo: shareRepository },
    );

    expect(shareRepository.findByEvent).toHaveBeenCalledWith(
      eventId,
      expect.objectContaining({
        limit: 10,
        sort: "-contributionAmount",
      }),
    );
    expect(result.summary).toMatchObject({
      totalInvestors: 0,
      totalInvested: "0",
      averageInvestment: "0",
      largestInvestment: "0",
      contributionCount: 0,
    });

    contributionFind.mockRestore();
  });

  test("cancels ticketing event on-chain with reason metadata", async () => {
    const ticketingEvent = {
      _id: "507f1f77bcf86cd799439099",
      title: "Slow sales",
      organizer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      status: "ticketing",
      contractEventId: "9",
      fundingGoal: "1000",
      currentFunding: "1000",
    };

    const repository = {
      findById: jest.fn().mockResolvedValue(ticketingEvent),
      updateById: jest.fn().mockResolvedValue({
        ...ticketingEvent,
        status: "cancelled",
        cancellationReason: "ticket_sales_not_met",
        cancellationNote: "sales too low",
      }),
    };

    const result = await updateEventStatus(
      ticketingEvent._id,
      "cancelled",
      {
        reason: "sales too low",
        actor: {
          walletAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      },
      { eventRepo: repository },
    );

    expect(mockFundWithSigner.cancelEvent).toHaveBeenCalledWith(9n, 2);
    expect(repository.updateById).toHaveBeenCalledWith(
      ticketingEvent._id,
      expect.objectContaining({
        status: "cancelled",
        cancellationReason: "ticket_sales_not_met",
        cancellationNote: "sales too low",
        cancelledBy: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      }),
    );
    expect(result).toMatchObject({
      status: "cancelled",
      cancellationReason: "ticket_sales_not_met",
    });
  });
});
