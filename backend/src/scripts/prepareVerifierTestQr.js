import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { connectDB, disconnectDB } from "../config/database.js";
import Event from "../models/Event.model.js";
import Ticket from "../models/Ticket.model.js";
import User from "../models/User.model.js";
import { qrcode } from "../../../frontend/node_modules/qrcode-generator/dist/qrcode.mjs";

function normalizeWallet(value) {
  return value ? String(value).trim().toLowerCase() : null;
}

function buildVerifierQrPayload(ticket, eventId) {
  return `eft1:${String(ticket.tokenId).trim()}:${String(eventId).trim()}`;
}

function createFarFutureDate() {
  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
}

async function findVerifier(walletArg) {
  if (walletArg) {
    const verifier = await User.findOne({
      walletAddress: normalizeWallet(walletArg),
      role: "verifier",
    });

    if (!verifier) {
      throw new Error(`Verifier wallet not found: ${walletArg}`);
    }

    return verifier;
  }

  const verifier = await User.findOne({ role: "verifier" }).sort({ createdAt: 1 });
  if (!verifier) {
    throw new Error("No verifier user found in database");
  }

  return verifier;
}

async function findOrCreateOwnerUser() {
  let user = await User.findOne({ role: "user" }).sort({ createdAt: 1 });
  if (user) {
    return user;
  }

  user = await User.create({
    walletAddress: "0x9999999999999999999999999999999999999999",
    username: "VerifierTestUser",
    email: `verifier-test-user-${Date.now()}@local.test`,
    role: "user",
    nonce: `nonce_${Date.now()}`,
    nonceExpiresAt: createFarFutureDate(),
    isActive: true,
  });

  return user;
}

async function findTicket(tokenIdArg) {
  if (tokenIdArg) {
    return Ticket.findOne({ tokenId: String(tokenIdArg).trim() });
  }

  const soldTicket = await Ticket.findOne({ status: "sold" }).sort({
    soldAt: -1,
    createdAt: -1,
  });
  if (soldTicket) {
    return soldTicket;
  }

  const reusableTicket = await Ticket.findOne().sort({ createdAt: 1 });
  return reusableTicket;
}

async function ensureTicketReadyForCheckIn(ticket, ownerUser) {
  if (!ticket) {
    const testEvent = await Event.create({
      title: "Verifier QR Test Event",
      description: "Auto-generated event for verifier QR testing",
      category: "test",
      organizer: ownerUser.walletAddress,
      startDate: new Date(Date.now() - 30 * 60 * 1000),
      endDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
      fundingGoal: "0",
      minStakeRequired: "0",
      organizerStake: "0",
      currentFunding: "0",
      totalTickets: 1,
      status: "ongoing",
      ticketPrice: 1,
      maxTickets: 1,
      usedThreshold: 1,
      verifiers: [],
    });

    return Ticket.create({
      tokenId: `TEST-${Date.now()}`,
      eventId: testEvent._id,
      currentOwner: ownerUser.walletAddress,
      originalPrice: "1",
      ticketType: "standard",
      status: "sold",
      soldAt: new Date(),
      isListed: false,
      transferHistory: [],
    });
  }

  ticket.status = "sold";
  ticket.currentOwner = ownerUser.walletAddress;
  ticket.soldAt = ticket.soldAt || new Date();
  ticket.usedAt = undefined;
  ticket.usedTxHash = undefined;
  ticket.verifiedBy = undefined;
  ticket.isListed = false;
  await ticket.save();

  return ticket;
}

async function prepareEventForCheckIn(eventId, verifierWallet) {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new Error(`Event not found for id=${eventId}`);
  }

  const now = new Date();
  event.status = "ongoing";
  event.startDate = new Date(now.getTime() - 30 * 60 * 1000);
  event.endDate = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  if (!Array.isArray(event.verifiers)) {
    event.verifiers = [];
  }

  const normalizedVerifier = normalizeWallet(verifierWallet);
  if (!event.verifiers.includes(normalizedVerifier)) {
    event.verifiers.push(normalizedVerifier);
  }

  await event.save();
  return event;
}

async function writeQrFiles(tokenId, payloadString) {
  const qr = qrcode(0, "M");
  qr.addData(payloadString);
  qr.make();

  const outputDir = new URL("../../tmp/", import.meta.url);
  await mkdir(outputDir, { recursive: true });

  const safeToken = String(tokenId).replace(/[^a-zA-Z0-9_-]/g, "-");
  const svgPath = new URL(`./verifier-test-${safeToken}.svg`, outputDir);
  const jsonPath = new URL(`./verifier-test-${safeToken}.json`, outputDir);

  await writeFile(
    svgPath,
    qr.createSvgTag({ cellSize: 8, margin: 24, scalable: true }),
    "utf8",
  );
  await writeFile(jsonPath, `${payloadString}\n`, "utf8");

  return {
    svgPath: fileURLToPath(svgPath),
    jsonPath: fileURLToPath(jsonPath),
  };
}

async function run() {
  const tokenIdArg = process.argv[2];
  const verifierWalletArg = process.argv[3];

  try {
    await connectDB();

    const [rawTicket, verifier, ownerUser] = await Promise.all([
      findTicket(tokenIdArg),
      findVerifier(verifierWalletArg),
      findOrCreateOwnerUser(),
    ]);

    const ticket = await ensureTicketReadyForCheckIn(rawTicket, ownerUser);
    const event = await prepareEventForCheckIn(
      ticket.eventId,
      verifier.walletAddress,
    );

    const payloadString = buildVerifierQrPayload(ticket, event._id);
    const { svgPath, jsonPath } = await writeQrFiles(
      ticket.tokenId,
      payloadString,
    );

    console.log("Verifier test scenario is ready.");
    console.log(`Verifier wallet: ${verifier.walletAddress}`);
    console.log(`Verifier username: ${verifier.username || "(no username)"}`);
    console.log(`Event: ${event.title} (${event._id})`);
    console.log(`Ticket: ${ticket.tokenId}`);
    console.log(`Ticket owner: ${ticket.currentOwner}`);
    console.log(`QR payload: ${payloadString}`);
    console.log(`QR svg: ${svgPath}`);
    console.log(`Payload json: ${jsonPath}`);
  } finally {
    await disconnectDB();
  }
}

run().catch((error) => {
  console.error("Failed to prepare verifier test QR:", error);
  process.exitCode = 1;
});
