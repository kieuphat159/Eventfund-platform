import mongoose from "mongoose";
import dotenv from "dotenv";

import {
  Event,
  Ticket,
  Listing,
  Share,
  RewardClaim,
  Contribution,
  RevenueDistribution,
  Penalty,
  TicketEvent,
  TicketStats,
  ChainLog,
} from "../models/index.js";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

function normalizeAddress(value) {
  return value ? String(value).toLowerCase() : null;
}

function parseArgs(argv) {
  const args = {
    apply: false,
    targetFundAddress: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--apply") {
      args.apply = true;
      continue;
    }

    if (token === "--fund-address") {
      args.targetFundAddress = normalizeAddress(argv[i + 1]);
      i += 1;
    }
  }

  return args;
}

function buildMongoUri() {
  return (
    process.env.MONGO_PROD_URI ||
    process.env.MONGO_URI ||
    process.env.MONGO_STAG_URI
  );
}

async function loadHistoricalEvents(activeFundAddress, targetFundAddress) {
  if (targetFundAddress) {
    return Event.find({
      fundContractAddress: targetFundAddress,
    })
      .select({
        _id: 1,
        title: 1,
        contractEventId: 1,
        fundContractAddress: 1,
        status: 1,
        createdAt: 1,
      })
      .sort({ fundContractAddress: 1, createdAt: 1 })
      .lean();
  }

  return Event.find({
    fundContractAddress: { $exists: true, $nin: [null, "", activeFundAddress] },
  })
    .select({
      _id: 1,
      title: 1,
      contractEventId: 1,
      fundContractAddress: 1,
      status: 1,
      createdAt: 1,
    })
    .sort({ fundContractAddress: 1, createdAt: 1 })
    .lean();
}

async function countDocumentsForCleanup(eventObjectIds, contractEventIds, oldFundAddresses) {
  const eventFilter = { $in: eventObjectIds };
  const contractEventFilter = { $in: contractEventIds };
  const fundAddressFilter = { $in: oldFundAddresses };

  const counts = {
    events: await Event.countDocuments({ _id: eventFilter }),
    tickets: await Ticket.countDocuments({ eventId: eventFilter }),
    listings: await Listing.countDocuments({ eventId: eventFilter }),
    shares: await Share.countDocuments({ eventId: eventFilter }),
    rewardClaims: await RewardClaim.countDocuments({ eventId: eventFilter }),
    contributions: await Contribution.countDocuments({ eventId: eventFilter }),
    revenueDistributions: await RevenueDistribution.countDocuments({
      eventId: eventFilter,
    }),
    penalties: await Penalty.countDocuments({ eventId: eventFilter }),
    ticketEvents: await TicketEvent.countDocuments({ eventId: contractEventFilter }),
    ticketStats: await TicketStats.countDocuments({ eventId: contractEventFilter }),
    fundChainLogs: await ChainLog.countDocuments({
      contractName: "Fund",
      contractAddress: fundAddressFilter,
    }),
    ticketChainLogs: await ChainLog.countDocuments({
      contractName: "Ticket",
      "args.eventId": contractEventFilter,
    }),
  };

  counts.totalDocuments = Object.values(counts).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );

  return counts;
}

async function deleteHistoricalDeploymentData(
  eventObjectIds,
  contractEventIds,
  oldFundAddresses,
) {
  const eventFilter = { $in: eventObjectIds };
  const contractEventFilter = { $in: contractEventIds };
  const fundAddressFilter = { $in: oldFundAddresses };

  return {
    tickets: await Ticket.deleteMany({ eventId: eventFilter }),
    listings: await Listing.deleteMany({ eventId: eventFilter }),
    shares: await Share.deleteMany({ eventId: eventFilter }),
    rewardClaims: await RewardClaim.deleteMany({ eventId: eventFilter }),
    contributions: await Contribution.deleteMany({ eventId: eventFilter }),
    revenueDistributions: await RevenueDistribution.deleteMany({
      eventId: eventFilter,
    }),
    penalties: await Penalty.deleteMany({ eventId: eventFilter }),
    ticketEvents: await TicketEvent.deleteMany({ eventId: contractEventFilter }),
    ticketStats: await TicketStats.deleteMany({ eventId: contractEventFilter }),
    fundChainLogs: await ChainLog.deleteMany({
      contractName: "Fund",
      contractAddress: fundAddressFilter,
    }),
    ticketChainLogs: await ChainLog.deleteMany({
      contractName: "Ticket",
      "args.eventId": contractEventFilter,
    }),
    events: await Event.deleteMany({ _id: eventFilter }),
  };
}

async function main() {
  const { apply, targetFundAddress } = parseArgs(process.argv);
  const mongoUri = buildMongoUri();
  const activeFundAddress = normalizeAddress(process.env.FUND_ADDRESS);

  if (!mongoUri) {
    throw new Error("Missing MongoDB URI in backend/.env");
  }

  if (!activeFundAddress && !targetFundAddress) {
    throw new Error(
      "Missing FUND_ADDRESS. Provide backend/.env FUND_ADDRESS or pass --fund-address <oldFundAddress>.",
    );
  }

  await mongoose.connect(mongoUri);

  const historicalEvents = await loadHistoricalEvents(
    activeFundAddress,
    targetFundAddress,
  );

  if (!historicalEvents.length) {
    console.log(
      "[cleanupHistoricalFundDeployment] No historical deployment events found.",
    );
    await mongoose.disconnect();
    return;
  }

  const eventObjectIds = historicalEvents.map((eventDoc) => eventDoc._id);
  const contractEventIds = historicalEvents
    .map((eventDoc) => String(eventDoc.contractEventId || ""))
    .filter(Boolean);
  const oldFundAddresses = [
    ...new Set(
      historicalEvents
        .map((eventDoc) => normalizeAddress(eventDoc.fundContractAddress))
        .filter(Boolean),
    ),
  ];

  const counts = await countDocumentsForCleanup(
    eventObjectIds,
    contractEventIds,
    oldFundAddresses,
  );

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        activeFundAddress,
        targetFundAddress,
        historicalFundAddresses: oldFundAddresses,
        historicalEvents: historicalEvents.map((eventDoc) => ({
          id: String(eventDoc._id),
          title: eventDoc.title,
          status: eventDoc.status,
          contractEventId: eventDoc.contractEventId,
          fundContractAddress: eventDoc.fundContractAddress,
          createdAt: eventDoc.createdAt,
        })),
        counts,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log(
      "\nDry-run only. Re-run with --apply to delete these historical deployment records from MongoDB.",
    );
    await mongoose.disconnect();
    return;
  }

  const result = await deleteHistoricalDeploymentData(
    eventObjectIds,
    contractEventIds,
    oldFundAddresses,
  );

  console.log(
    JSON.stringify(
      {
        deleted: {
          tickets: result.tickets.deletedCount || 0,
          listings: result.listings.deletedCount || 0,
          shares: result.shares.deletedCount || 0,
          rewardClaims: result.rewardClaims.deletedCount || 0,
          contributions: result.contributions.deletedCount || 0,
          revenueDistributions: result.revenueDistributions.deletedCount || 0,
          penalties: result.penalties.deletedCount || 0,
          ticketEvents: result.ticketEvents.deletedCount || 0,
          ticketStats: result.ticketStats.deletedCount || 0,
          fundChainLogs: result.fundChainLogs.deletedCount || 0,
          ticketChainLogs: result.ticketChainLogs.deletedCount || 0,
          events: result.events.deletedCount || 0,
        },
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("[cleanupHistoricalFundDeployment] Failed:", error);
  process.exit(1);
});
