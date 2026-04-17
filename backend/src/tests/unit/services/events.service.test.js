import { jest } from "@jest/globals";

const mockProvider = {
  getTransactionReceipt: jest.fn(),
};

const mockFundWithSigner = {
  createEvent: jest.fn(),
  createEventWithInvestment: jest.fn(),
  finalizeFunding: jest.fn(),
};

mockFundWithSigner.createEventWithInvestment.staticCall = jest.fn();

const mockFund = {
  getAddress: jest.fn(),
  connect: jest.fn(() => mockFundWithSigner),
  interface: {
    parseLog: jest.fn(),
  },
};

const mockGetFund = jest.fn(() => mockFund);
const mockPersistLogsFromReceipt = jest.fn();
const mockUploadEventMetadataToIpfs = jest.fn();

jest.unstable_mockModule("../../../services/blockchain/index.js", () => ({
  provider: mockProvider,
  getFund: mockGetFund,
}));

jest.unstable_mockModule(
  "../../../services/blockchain/core/receiptChainLog.js",
  () => ({
    persistLogsFromReceipt: mockPersistLogsFromReceipt,
  }),
);

jest.unstable_mockModule("../../../services/upload/ipfs.service.js", () => ({
  uploadEventMetadataToIpfs: mockUploadEventMetadataToIpfs,
}));

const { confirmCreateEventTransaction, createCreateEventIntent, createEvent } =
  await import("../../../services/events/events.service.js");

describe("events.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFund.mockReturnValue(mockFund);
    mockFund.connect.mockReturnValue(mockFundWithSigner);
    mockUploadEventMetadataToIpfs.mockResolvedValue("ipfs://event-metadata");
  });

  test("accepts smart-account create tx for a draft owned by the same user's EOA", async () => {
    const eoaAddress = "0x1111111111111111111111111111111111111111";
    const smartAccountAddress = "0x2222222222222222222222222222222222222222";
    const fundAddress = "0x3333333333333333333333333333333333333333";
    const txHash = `0x${"a".repeat(64)}`;
    const draftEventId = "507f1f77bcf86cd799439011";

    const user = {
      walletAddress: eoaAddress,
      smartAccountAddress,
      role: "user",
    };

    const draftEvent = {
      _id: draftEventId,
      organizer: eoaAddress.toLowerCase(),
      status: "draft",
    };

    const updatedEvent = {
      ...draftEvent,
      contractEventId: "77",
      onChainOrganizer: smartAccountAddress.toLowerCase(),
      status: "funding",
    };

    const repository = {
      findById: jest.fn().mockResolvedValue(draftEvent),
      updateById: jest.fn().mockResolvedValue(updatedEvent),
      findMatchingDraftForOnChainEvent: jest.fn(),
    };

    mockFund.getAddress.mockResolvedValue(fundAddress);
    mockFund.interface.parseLog.mockReturnValue({
      name: "EventCreated",
      args: {
        eventId: 77n,
        organizer: smartAccountAddress,
        fundingGoal: 1000n,
        minStakeRequired: 100n,
        ticketPrice: 1n,
        maxTickets: 50n,
        usedThreshold: 50n,
      },
    });

    mockProvider.getTransactionReceipt.mockResolvedValue({
      status: 1,
      logs: [
        {
          address: fundAddress,
          topics: ["0xtopic"],
          data: "0xdata",
        },
      ],
    });

    const result = await confirmCreateEventTransaction(
      {
        txHash,
        draftEventId,
        organizerWallet: smartAccountAddress,
      },
      user,
      { eventRepo: repository },
    );

    expect(repository.findById).toHaveBeenCalledWith(draftEventId);
    expect(repository.updateById).toHaveBeenCalledWith(
      draftEventId,
      expect.objectContaining({
        contractEventId: "77",
        onChainOrganizer: smartAccountAddress.toLowerCase(),
        status: "funding",
      }),
    );
    expect(mockPersistLogsFromReceipt).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      synced: true,
      alreadySynced: false,
      txHash,
      contractEventId: "77",
    });
    expect(result.event).toMatchObject(updatedEvent);
  });

  test("treats receipt lookup failures as retryable when confirming create-event tx", async () => {
    const eoaAddress = "0x1111111111111111111111111111111111111111";
    const txHash = `0x${"b".repeat(64)}`;

    mockProvider.getTransactionReceipt.mockRejectedValueOnce(
      new Error("missing response"),
    );

    await expect(
      confirmCreateEventTransaction(
        {
          txHash,
          organizerWallet: eoaAddress,
        },
        {
          walletAddress: eoaAddress,
        },
        {},
      ),
    ).rejects.toThrow("Transaction not mined yet");
  });

  test("creates zero-funding event on-chain as funded via relayer", async () => {
    const eventId = "507f1f77bcf86cd799439012";
    const userAddress = "0x1111111111111111111111111111111111111111";
    const relayerOrganizer = "0x4444444444444444444444444444444444444444";

    const createdDraft = {
      _id: eventId,
      organizer: userAddress,
      status: "draft",
    };

    const updatedEvent = {
      ...createdDraft,
      contractEventId: "12",
      onChainOrganizer: relayerOrganizer,
      status: "funded",
    };

    const repository = {
      createEvent: jest.fn().mockResolvedValue(createdDraft),
      updateById: jest.fn().mockResolvedValue(updatedEvent),
      deleteById: jest.fn(),
    };

    mockFund.getAddress.mockResolvedValue(
      "0x3333333333333333333333333333333333333333",
    );
    mockFund.interface.parseLog.mockReturnValue({
      name: "EventCreated",
      args: {
        eventId: 12n,
        organizer: relayerOrganizer,
      },
    });
    mockFundWithSigner.createEventWithInvestment.mockResolvedValue({
      wait: jest.fn().mockResolvedValue({
        status: 1,
        logs: [
          {
            address: "0x3333333333333333333333333333333333333333",
            topics: ["0xtopic"],
            data: "0xcreated",
          },
        ],
      }),
    });

    const result = await createEvent(
      {
        title: "No-invest event",
        description: "Already funded",
        category: "conference",
        investmentEnabled: false,
        organizerStake: "25",
        startDate: "2026-06-01T10:00:00.000Z",
        endDate: "2026-06-01T12:00:00.000Z",
        totalTickets: 100,
        venue: { address: "Test venue" },
        ticketTiers: [{ name: "General", price: 1, totalSupply: 100 }],
      },
      {
        walletAddress: userAddress,
      },
      { eventRepo: repository },
    );

    expect(mockFundWithSigner.createEventWithInvestment).toHaveBeenCalledWith(
      0n,
      0n,
      25n,
      7000n,
      1n,
      100n,
      100n,
      false,
      { value: 25n },
    );
    expect(repository.updateById).toHaveBeenCalledWith(
      eventId,
      expect.objectContaining({
        contractEventId: "12",
        onChainOrganizer: relayerOrganizer,
        status: "funded",
      }),
    );
    expect(result).toMatchObject(updatedEvent);
  });

  test("builds self-funded create intent that charges organizer wallet stake", async () => {
    const repository = {
      createEvent: jest.fn().mockResolvedValue({
        _id: "507f1f77bcf86cd799439014",
        organizer: "0x1111111111111111111111111111111111111111",
        status: "draft",
      }),
    };

    mockFund.getAddress.mockResolvedValue(
      "0x3333333333333333333333333333333333333333",
    );
    mockProvider.getNetwork = jest
      .fn()
      .mockResolvedValue({ chainId: 11155111n });

    const intent = await createCreateEventIntent(
      {
        title: "No-invest event",
        description: "Already funded",
        category: "conference",
        investmentEnabled: false,
        organizerStake: "25",
        startDate: "2026-06-01T10:00:00.000Z",
        endDate: "2026-06-01T12:00:00.000Z",
        totalTickets: 100,
        venue: { address: "Test venue" },
        ticketTiers: [{ name: "General", price: 1, totalSupply: 100 }],
      },
      {
        walletAddress: "0x1111111111111111111111111111111111111111",
      },
      { eventRepo: repository },
    );

    expect(intent.transaction.to).toBe(
      "0x3333333333333333333333333333333333333333",
    );
    expect(intent.transaction.value).toBe("25");
    expect(intent.transaction.functionName).toBe("createEventWithInvestment");
    expect(intent.transaction.data).toContain("0x");
  });

  test("requires organizer stake for no-invest event creation", async () => {
    await expect(
      createEvent(
        {
          title: "No-invest event",
          description: "Already funded",
          category: "conference",
          investmentEnabled: false,
          startDate: "2026-06-01T10:00:00.000Z",
          endDate: "2026-06-01T12:00:00.000Z",
          totalTickets: 100,
          venue: { address: "Test venue" },
          ticketTiers: [{ name: "General", price: 1, totalSupply: 100 }],
        },
        {
          walletAddress: "0x1111111111111111111111111111111111111111",
        },
        { eventRepo: {} },
      ),
    ).rejects.toThrow(
      "organizerStake must be greater than 0 when investment is disabled",
    );
  });

  test("surfaces self-funded contract revert reason when no-invest mode is supported", async () => {
    const createdDraft = {
      _id: "507f1f77bcf86cd799439013",
      organizer: "0x1111111111111111111111111111111111111111",
      status: "draft",
    };

    const repository = {
      createEvent: jest.fn().mockResolvedValue(createdDraft),
      updateById: jest.fn(),
      deleteById: jest.fn(),
    };

    mockFund.getAddress.mockResolvedValue(
      "0x3333333333333333333333333333333333333333",
    );
    mockFundWithSigner.createEventWithInvestment.mockRejectedValue(
      new Error("execution reverted: BadParam()"),
    );
    mockFundWithSigner.createEventWithInvestment.staticCall.mockResolvedValue(
      3n,
    );

    await expect(
      createEvent(
        {
          title: "No-invest event",
          description: "Already funded",
          category: "conference",
          investmentEnabled: false,
          organizerStake: "25",
          startDate: "2026-06-01T10:00:00.000Z",
          endDate: "2026-06-01T12:00:00.000Z",
          totalTickets: 100,
          venue: { address: "Test venue" },
          ticketTiers: [{ name: "General", price: 1, totalSupply: 100 }],
        },
        {
          walletAddress: "0x1111111111111111111111111111111111111111",
        },
        { eventRepo: repository },
      ),
    ).rejects.toThrow(
      "Create self-funded event transaction reverted: execution reverted: BadParam()",
    );

    expect(repository.deleteById).toHaveBeenCalledWith(createdDraft._id);
    expect(
      mockFundWithSigner.createEventWithInvestment.staticCall,
    ).toHaveBeenCalledTimes(1);
  });
});
