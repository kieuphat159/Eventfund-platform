import { connectTestDB, disconnectTestDB, clearTestDB } from "../../helpers/db.helper.js";

describe("Blockchain Reorg Safety Regressions", () => {
  const FUND_ADDR = "0x00000000000000000000000000000000000000f1";
  const TICKET_ADDR = "0x00000000000000000000000000000000000000f2";
  const MARKET_ADDR = "0x00000000000000000000000000000000000000f3";

  const CONTRACT_EID = "42";
  const ORGANIZER = "0x1000000000000000000000000000000000000001";
  const DONATOR = "0x2000000000000000000000000000000000000001";
  const DONATOR2 = "0x2000000000000000000000000000000000000002";
  const BUYER = "0x3000000000000000000000000000000000000001";

  let processFundLogsOnce;
  let processTicketLogsOnce;
  let processMarketplaceLogsOnce;

  let ChainLog;
  let EventModel;
  let ContributionModel;
  let TicketModel;
  let TicketStats;
  let ListingModel;
  let BlockchainSyncState;
  let eventRepo;

  let providerMod;
  let contractsMod;

  let mockLatestBlock = 0;
  let logIndexSeed = 0;

  function makeLog({ contractName, contractAddress, eventName, args, blockNumber, canonical = false }) {
    const idx = logIndexSeed++;
    const prefix = canonical ? "canonical" : "blockhash";

    return {
      contractName,
      contractAddress: contractAddress.toLowerCase(),
      blockNumber,
      blockHash: `0x${prefix}${String(blockNumber).padStart(10, "0")}${String(idx).padStart(10, "0")}000000000000000000000000000000000000`,
      transactionHash: `0xtxhash${String(blockNumber).padStart(10, "0")}${String(idx).padStart(10, "0")}000000000000000000000000000000000000`,
      transactionIndex: 0,
      logIndex: idx,
      topics: ["0x0000000000000000000000000000000000000000000000000000000000000001"],
      data: "0x",
      eventName,
      args,
    };
  }

  async function createEventDoc() {
    const now = Date.now();
    return EventModel.create({
      contractEventId: CONTRACT_EID,
      fundContractAddress: FUND_ADDR.toLowerCase(),
      title: `Reorg Test Event ${CONTRACT_EID}`,
      organizer: ORGANIZER.toLowerCase(),
      startDate: new Date(now + 86400 * 7 * 1000),
      endDate: new Date(now + 86400 * 8 * 1000),
      totalTickets: 100,
      status: "draft",
      escrowStatus: "holding",
    });
  }

  async function createTicketDoc(eventId, tokenId = "101") {
    return TicketModel.findOneAndUpdate(
      { tokenId },
      {
        tokenId,
        eventId,
        currentOwner: BUYER.toLowerCase(),
        originalPrice: "500000000000000",
        status: "sold",
      },
      { upsert: true, new: true }
    );
  }

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.RPC_URL = process.env.RPC_URL || "http://localhost:8545";
    process.env.FUND_ADDRESS = FUND_ADDR;
    process.env.TICKET_ADDRESS = TICKET_ADDR;
    process.env.MARKETPLACE_ADDRESS = MARKET_ADDR;
    process.env.CHAIN_CONFIRMATIONS = "0";
    process.env.REORG_BUFFER_BLOCKS = "32";
    process.env.FUND_START_BLOCK = "0";
    process.env.TICKET_START_BLOCK = "0";
    process.env.MARKETPLACE_START_BLOCK = "0";

    await connectTestDB();

    ({ processFundLogsOnce } = await import("../../../services/blockchain/processors/fund.processor.js"));
    ({ processTicketLogsOnce } = await import("../../../services/blockchain/processors/ticket.processor.js"));
    ({ processMarketplaceLogsOnce } = await import("../../../services/blockchain/processors/marketplace.processor.js"));

    ({ ChainLog } = await import("../../../models/ChainLog.js"));
    ({ default: EventModel } = await import("../../../models/Event.model.js"));
    ({ default: ContributionModel } = await import("../../../models/Contribution.model.js"));
    ({ default: TicketModel } = await import("../../../models/Ticket.model.js"));
    ({ TicketStats } = await import("../../../models/TicketStats.model.js"));
    ({ default: ListingModel } = await import("../../../models/Listing.model.js"));
    ({ BlockchainSyncState } = await import("../../../models/BlockchainSyncState.model.js"));
    ({ default: eventRepo } = await import("../../../repositories/event.repo.js"));

    providerMod = await import("../../../services/blockchain/core/provider.js");
    providerMod.provider.getBlockNumber = async () => mockLatestBlock;

    contractsMod = await import("../../../services/blockchain/core/contracts/index.js");
    const patchAddress = (getter, addr) => {
      try {
        getter().getAddress = async () => addr;
      } catch (_e) {
        // no-op in tests
      }
    };

    patchAddress(contractsMod.getFund, FUND_ADDR);
    patchAddress(contractsMod.getTicket, TICKET_ADDR);
    patchAddress(contractsMod.getMarketplace, MARKET_ADDR);
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    logIndexSeed = 0;
    mockLatestBlock = 0;

    process.env.CHAIN_CONFIRMATIONS = "0";
    process.env.REORG_BUFFER_BLOCKS = "64";
    process.env.FUND_START_BLOCK = "0";
    process.env.TICKET_START_BLOCK = "0";
    process.env.MARKETPLACE_START_BLOCK = "0";
  });

  test("Fund: hash-changed reorg must remove orphan tx from old block version", async () => {
    await createEventDoc();
    mockLatestBlock = 21;

    const firstPassLogs = [
      makeLog({
        contractName: "Fund",
        contractAddress: FUND_ADDR,
        eventName: "EventCreated",
        args: {
          eventId: CONTRACT_EID,
          organizer: ORGANIZER,
          fundingGoal: "1000000000000000000",
          fundingDeadline: String(Math.floor(Date.now() / 1000) + 86400 * 30),
          minStakeRequired: "100000000000000000",
          organizerShareBps: 1000,
          ticketPrice: 500000000000000,
          maxTickets: 100,
          usedThreshold: 80,
          stakeAmount: "200000000000000000",
        },
        blockNumber: 10,
      }),
      makeLog({
        contractName: "Fund",
        contractAddress: FUND_ADDR,
        eventName: "ContributionMade",
        args: {
          eventId: CONTRACT_EID,
          donator: DONATOR,
          amount: "500000000000000000",
        },
        blockNumber: 20,
      }),
    ];

    await ChainLog.insertMany(firstPassLogs, { ordered: false });
    await processFundLogsOnce();

    let ev = await EventModel.findOne({ contractEventId: CONTRACT_EID }).lean();
    expect(ev.currentFunding).toBe("500000000000000000");

    await ChainLog.deleteMany({ contractAddress: FUND_ADDR.toLowerCase(), blockNumber: 20 });
    const canonicalLog = makeLog({
      contractName: "Fund",
      contractAddress: FUND_ADDR,
      eventName: "ContributionMade",
      args: {
        eventId: CONTRACT_EID,
        donator: DONATOR2,
        amount: "100000000000000000",
      },
      blockNumber: 20,
      canonical: true,
    });
    await ChainLog.insertMany([canonicalLog], { ordered: false });

    await processFundLogsOnce();

    ev = await EventModel.findOne({ contractEventId: CONTRACT_EID }).lean();
    expect(ev.currentFunding).toBe("100000000000000000");
  });

  test("Fund: ContributionRefunded must not mark organizer_stake as refunded", async () => {
    const eventDoc = await createEventDoc();
    mockLatestBlock = 12;

    await ContributionModel.insertMany([
      {
        eventId: eventDoc._id,
        contributor: ORGANIZER.toLowerCase(),
        type: "organizer_stake",
        amount: 200,
        txHash: "0xstake000000000000000000000000000000000000000000000000000000000001",
        status: "confirmed",
      },
      {
        eventId: eventDoc._id,
        contributor: ORGANIZER.toLowerCase(),
        type: "donator_contribution",
        amount: 50,
        txHash: "0xcontrib0000000000000000000000000000000000000000000000000000000001",
        status: "confirmed",
      },
    ]);

    await ChainLog.insertMany([
      makeLog({
        contractName: "Fund",
        contractAddress: FUND_ADDR,
        eventName: "ContributionRefunded",
        args: {
          eventId: CONTRACT_EID,
          donator: ORGANIZER,
          amount: "50",
        },
        blockNumber: 12,
      }),
    ]);

    await processFundLogsOnce();

    const stakeDoc = await ContributionModel.findOne({
      eventId: eventDoc._id,
      contributor: ORGANIZER.toLowerCase(),
      type: "organizer_stake",
    }).lean();

    const donatorDoc = await ContributionModel.findOne({
      eventId: eventDoc._id,
      contributor: ORGANIZER.toLowerCase(),
      type: "donator_contribution",
    }).lean();

    expect(stakeDoc.status).toBe("confirmed");
    expect(donatorDoc.status).toBe("refunded");
  });

  test("Ticket: when canonical logs disappear, TicketStats must rebuild down to zero", async () => {
    mockLatestBlock = 11;

    const logs = [
      makeLog({
        contractName: "Ticket",
        contractAddress: TICKET_ADDR,
        eventName: "TicketPurchased",
        args: {
          tokenId: "101",
          eventId: CONTRACT_EID,
          buyer: BUYER,
          price: "500000000000000",
        },
        blockNumber: 10,
      }),
    ];

    await ChainLog.insertMany(logs, { ordered: false });
    await processTicketLogsOnce();

    let stats = await TicketStats.findOne({ eventId: CONTRACT_EID }).lean();
    expect(stats.totalSold).toBe(1);

    await ChainLog.deleteMany({ contractAddress: TICKET_ADDR.toLowerCase(), blockNumber: 10 });
    await processTicketLogsOnce();

    stats = await TicketStats.findOne({ eventId: CONTRACT_EID }).lean();
    expect(stats.totalSold).toBe(0);
  });

  test("Marketplace: hash-changed block must rebuild old listingId affected in previous block version", async () => {
    const eventDoc = await createEventDoc();
    await createTicketDoc(eventDoc._id, "101");

    mockLatestBlock = 111;

    const firstPassLogs = [
      makeLog({
        contractName: "Marketplace",
        contractAddress: MARKET_ADDR,
        eventName: "ListingCreated",
        args: {
          listingId: "7",
          tokenId: "101",
          seller: BUYER,
          price: "600000000000000",
          maxPrice: "800000000000000",
        },
        blockNumber: 100,
      }),
      makeLog({
        contractName: "Marketplace",
        contractAddress: MARKET_ADDR,
        eventName: "ListingSold",
        args: {
          listingId: "7",
          tokenId: "101",
          buyer: ORGANIZER,
          seller: BUYER,
          price: "600000000000000",
          royaltyAmount: "30000000000000",
        },
        blockNumber: 110,
      }),
    ];

    await ChainLog.insertMany(firstPassLogs, { ordered: false });
    await processMarketplaceLogsOnce();

    let listing = await ListingModel.findOne({ contractListingId: "7" }).lean();
    expect(listing.status).toBe("sold");

    await ChainLog.deleteMany({ contractAddress: MARKET_ADDR.toLowerCase(), blockNumber: 110 });
    const canonicalLog = makeLog({
      contractName: "Marketplace",
      contractAddress: MARKET_ADDR,
      eventName: "ListingCreated",
      args: {
        listingId: "8",
        tokenId: "101",
        seller: BUYER,
        price: "650000000000000",
        maxPrice: "850000000000000",
      },
      blockNumber: 110,
      canonical: true,
    });
    await ChainLog.insertMany([canonicalLog], { ordered: false });

    await processMarketplaceLogsOnce();

    listing = await ListingModel.findOne({ contractListingId: "7" }).lean();
    expect(listing.status).toBe("active");

    const newListing = await ListingModel.findOne({ contractListingId: "8" }).lean();
    expect(newListing.status).toBe("active");
  });

  test("Marketplace regression: hash-changed block must include old saved listingId even when its ListingCreated is outside reorg buffer", async () => {
    const eventDoc = await createEventDoc();
    await createTicketDoc(eventDoc._id, "101");

    // Keep buffer small so block 10 is out of second-run replay window.
    process.env.REORG_BUFFER_BLOCKS = "12";
    mockLatestBlock = 110;

    const firstPassLogs = [
      makeLog({
        contractName: "Marketplace",
        contractAddress: MARKET_ADDR,
        eventName: "ListingCreated",
        args: {
          listingId: "7",
          tokenId: "101",
          seller: BUYER,
          price: "600000000000000",
          maxPrice: "800000000000000",
        },
        blockNumber: 10,
      }),
      makeLog({
        contractName: "Marketplace",
        contractAddress: MARKET_ADDR,
        eventName: "ListingSold",
        args: {
          listingId: "7",
          tokenId: "101",
          buyer: ORGANIZER,
          seller: BUYER,
          price: "600000000000000",
          royaltyAmount: "30000000000000",
        },
        blockNumber: 110,
      }),
    ];

    await ChainLog.insertMany(firstPassLogs, { ordered: false });
    await processMarketplaceLogsOnce();

    let listing = await ListingModel.findOne({ contractListingId: "7" }).lean();
    expect(listing.status).toBe("sold");

    // Reorg on block 110: canonical chain now has listing 8 only.
    await ChainLog.deleteMany({ contractAddress: MARKET_ADDR.toLowerCase(), blockNumber: 110 });
    const canonicalLog = makeLog({
      contractName: "Marketplace",
      contractAddress: MARKET_ADDR,
      eventName: "ListingCreated",
      args: {
        listingId: "8",
        tokenId: "101",
        seller: BUYER,
        price: "650000000000000",
        maxPrice: "850000000000000",
      },
      blockNumber: 110,
      canonical: true,
    });
    await ChainLog.insertMany([canonicalLog], { ordered: false });

    // Second run only replays around block 110 due small buffer.
    await processMarketplaceLogsOnce();

    // Expected safe behavior: listing 7 is marked active by rebuild from historical chain logs.
    listing = await ListingModel.findOne({ contractListingId: "7" }).lean();
    expect(listing.status).toBe("active");
  });

  test("Fund idempotency regression: atomic delta by txHash prevents TOCTOU double increment", async () => {
    const eventDoc = await createEventDoc();
    const txHash = "0xrace000000000000000000000000000000000000000000000000000000000001";
    const field = "ticketRevenueDeposited";

    // Simulate two workers attempting to apply the same tx concurrently.
    await Promise.all([
      eventRepo.applyIdempotentDeltaByTxHash(eventDoc._id, txHash, field, {
        inc: { ticketRevenueDeposited: 50 },
      }),
      eventRepo.applyIdempotentDeltaByTxHash(eventDoc._id, txHash, field, {
        inc: { ticketRevenueDeposited: 50 },
      }),
    ]);

    const reloaded = await EventModel.findById(eventDoc._id).lean();
    expect(reloaded.ticketRevenueDeposited).toBe(50);
  });

  test("Sync state contractName key should stay unique for one processor", async () => {
    await BlockchainSyncState.create({
      contractName: "FundProcessor",
      contractAddress: FUND_ADDR.toLowerCase(),
      lastProcessedBlock: 10,
      status: "synced",
    });

    const duplicate = BlockchainSyncState.create({
      contractName: "FundProcessor",
      contractAddress: "0x0000000000000000000000000000000000000abc",
      lastProcessedBlock: 11,
      status: "synced",
    });

    await expect(duplicate).rejects.toThrow();
  });
});
