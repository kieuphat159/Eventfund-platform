import mongoose from "mongoose";
import dotenv from "dotenv";

import Event from "../models/Event.model.js";
import { ChainLog } from "../models/ChainLog.js";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

function normalizeAddress(value) {
  return value ? String(value).toLowerCase() : null;
}

function scoreCandidate(eventDoc, chainLogDoc) {
  let score = 0;
  const args = chainLogDoc?.args || {};

  if (normalizeAddress(args.organizer) === normalizeAddress(eventDoc.onChainOrganizer)) {
    score += 5;
  }

  if (normalizeAddress(args.organizer) === normalizeAddress(eventDoc.organizer)) {
    score += 3;
  }

  if (String(args.fundingGoal ?? "") === String(eventDoc.fundingGoal ?? "")) {
    score += 2;
  }

  if (
    String(args.minStakeRequired ?? "") ===
    String(eventDoc.minStakeRequired ?? "")
  ) {
    score += 2;
  }

  if (Number(args.ticketPrice ?? -1) === Number(eventDoc.ticketPrice ?? -2)) {
    score += 1;
  }

  if (Number(args.maxTickets ?? -1) === Number(eventDoc.maxTickets ?? -2)) {
    score += 1;
  }

  if (
    Number(args.usedThreshold ?? -1) === Number(eventDoc.usedThreshold ?? -2)
  ) {
    score += 1;
  }

  return score;
}

async function resolveFundContractAddress(eventDoc) {
  const candidates = await ChainLog.find(
    {
      contractName: "Fund",
      eventName: "EventCreated",
      "args.eventId": String(eventDoc.contractEventId),
    },
    {
      contractAddress: 1,
      args: 1,
      blockNumber: 1,
    },
  )
    .sort({ blockNumber: 1 })
    .lean();

  if (!candidates.length) return null;

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(eventDoc, candidate),
    }))
    .sort((a, b) => b.score - a.score || b.candidate.blockNumber - a.candidate.blockNumber);

  return normalizeAddress(ranked[0]?.candidate?.contractAddress);
}

async function main() {
  const mongoUri =
    process.env.MONGO_STAG_URI || process.env.MONGO_URI || process.env.MONGO_STAG_URI;

  if (!mongoUri) {
    throw new Error("Missing MongoDB URI in backend/.env");
  }

  await mongoose.connect(mongoUri);

  const events = await Event.find({
    contractEventId: { $exists: true, $ne: null },
    $or: [
      { fundContractAddress: { $exists: false } },
      { fundContractAddress: null },
      { fundContractAddress: "" },
    ],
  }).lean();

  let updated = 0;
  for (const eventDoc of events) {
    const fundContractAddress = await resolveFundContractAddress(eventDoc);
    if (!fundContractAddress) {
      console.warn(
        `[migrateEventFundScope] Could not resolve fund address for event ${eventDoc._id} contractEventId=${eventDoc.contractEventId}`,
      );
      continue;
    }

    await Event.updateOne(
      { _id: eventDoc._id },
      { $set: { fundContractAddress } },
    );
    updated += 1;
  }

  const collection = Event.collection;
  const indexes = await collection.indexes();

  if (indexes.some((index) => index.name === "contractEventId_1")) {
    await collection.dropIndex("contractEventId_1");
    console.log("[migrateEventFundScope] Dropped legacy unique index contractEventId_1");
  }

  await collection.createIndex(
    { contractEventId: 1 },
    { name: "contractEventId_lookup" },
  );

  const scopedIndex = indexes.find(
    (index) =>
      index.key?.fundContractAddress === 1 &&
      index.key?.contractEventId === 1 &&
      index.unique === true,
  );

  if (!scopedIndex) {
    await collection.createIndex(
      { fundContractAddress: 1, contractEventId: 1 },
      {
        name: "fundContractAddress_contractEventId_unique",
        unique: true,
        sparse: true,
      },
    );
  }

  console.log(
    `[migrateEventFundScope] Updated ${updated}/${events.length} events with fundContractAddress`,
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("[migrateEventFundScope] Failed:", error);
  process.exit(1);
});
