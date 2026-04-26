import { jest } from "@jest/globals";

const mockPersistLogsFromReceipt = jest.fn();
const mockGetFund = jest.fn();
const mockGetTicket = jest.fn();
const mockFund = {
  getAddress: jest.fn(),
};
const mockTicketWithSigner = {
  claimRefundFor: jest.fn(),
};
const mockTicket = {
  connect: jest.fn(() => mockTicketWithSigner),
  getAddress: jest.fn(),
  getEventTokenIds: jest.fn(),
  getTicketStatus: jest.fn(),
};

jest.unstable_mockModule("../../../services/blockchain/index.js", () => ({
  getFund: mockGetFund,
  getTicket: mockGetTicket,
  provider: {},
}));

jest.unstable_mockModule(
  "../../../services/blockchain/core/receiptChainLog.js",
  () => ({
    persistLogsFromReceipt: mockPersistLogsFromReceipt,
  }),
);

const {
  autoRefundCancelledEvent,
  resetAutoRefundQueueForTests,
  scheduleAutoRefundForCancelledEvent,
} = await import("../../../services/tickets/autoRefund.service.js");

describe("autoRefund.service", () => {
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetAutoRefundQueueForTests();
    mockGetFund.mockReturnValue(mockFund);
    mockGetTicket.mockReturnValue(mockTicket);
    mockTicket.connect.mockReturnValue(mockTicketWithSigner);

    mockFund.getAddress.mockResolvedValue(
      "0x2222222222222222222222222222222222222222",
    );
    mockTicket.getAddress.mockResolvedValue(
      "0x1111111111111111111111111111111111111111",
    );
  });

  test("automatically refunds sold tickets and skips already-settled ones", async () => {
    const markAsRefundedFromChain = jest.fn();

    mockTicket.getEventTokenIds.mockResolvedValue([1n, 2n, 3n]);
    mockTicket.getTicketStatus.mockImplementation(async (tokenId) => {
      const normalized = BigInt(tokenId).toString();
      if (normalized === "1") return 1n;
      if (normalized === "2") return 4n;
      return 0n;
    });
    mockTicketWithSigner.claimRefundFor.mockResolvedValue({
      hash: `0x${"a".repeat(64)}`,
      wait: jest.fn().mockResolvedValue({
        status: 1,
        hash: `0x${"a".repeat(64)}`,
        logs: [],
      }),
    });

    const result = await autoRefundCancelledEvent(
      {
        _id: "507f1f77bcf86cd799439011",
        contractEventId: "77",
      },
      {
        logger,
        repositories: {
          ticketRepo: {
            markAsRefundedFromChain,
          },
        },
        signer: { address: "0x3333333333333333333333333333333333333333" },
        ticketContract: mockTicket,
      },
    );

    expect(result).toEqual({
      eventId: "507f1f77bcf86cd799439011",
      inspected: 3,
      refunded: 1,
      alreadyRefunded: 1,
      skipped: 1,
      failed: 0,
    });
    expect(mockTicket.connect).toHaveBeenCalledTimes(1);
    expect(mockTicketWithSigner.claimRefundFor).toHaveBeenCalledTimes(1);
    expect(mockPersistLogsFromReceipt).toHaveBeenCalledTimes(2);
    expect(markAsRefundedFromChain).toHaveBeenCalledTimes(2);
    expect(markAsRefundedFromChain).toHaveBeenNthCalledWith(
      1,
      "1",
      expect.objectContaining({
        refundedTxHash: `0x${"a".repeat(64)}`,
      }),
    );
    expect(markAsRefundedFromChain).toHaveBeenNthCalledWith(
      2,
      "2",
      expect.not.objectContaining({
        refundedTxHash: expect.anything(),
      }),
    );
  });

  test("deduplicates queued auto-refund jobs for the same event", async () => {
    let resolveWait;
    const waitPromise = new Promise((resolve) => {
      resolveWait = resolve;
    });

    mockTicket.getEventTokenIds.mockResolvedValue([1n]);
    mockTicket.getTicketStatus.mockResolvedValue(1n);
    mockTicketWithSigner.claimRefundFor.mockResolvedValue({
      hash: `0x${"b".repeat(64)}`,
      wait: jest.fn().mockImplementation(() => waitPromise),
    });

    const firstTask = scheduleAutoRefundForCancelledEvent(
      {
        _id: "507f1f77bcf86cd799439012",
        contractEventId: "88",
      },
      {
        logger,
        repositories: {
          ticketRepo: {
            markAsRefundedFromChain: jest.fn(),
          },
        },
        signer: { address: "0x4444444444444444444444444444444444444444" },
        ticketContract: mockTicket,
      },
    );
    const secondTask = scheduleAutoRefundForCancelledEvent(
      {
        _id: "507f1f77bcf86cd799439012",
        contractEventId: "88",
      },
      {
        logger,
        repositories: {
          ticketRepo: {
            markAsRefundedFromChain: jest.fn(),
          },
        },
        signer: { address: "0x4444444444444444444444444444444444444444" },
        ticketContract: mockTicket,
      },
    );

    expect(firstTask).not.toBeNull();
    expect(secondTask).toBeNull();

    resolveWait({
      status: 1,
      hash: `0x${"b".repeat(64)}`,
      logs: [],
    });

    await firstTask;

    expect(mockTicketWithSigner.claimRefundFor).toHaveBeenCalledTimes(1);
  });
});
