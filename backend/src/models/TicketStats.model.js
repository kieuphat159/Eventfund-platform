import mongoose from "mongoose";

const TicketStatsSchema = new mongoose.Schema(
  {
    contractAddress: { type: String, required: true, index: true },
    eventId: { type: String, required: true, index: true },

    totalMinted: { type: Number, required: true, default: 0 },
    totalSold: { type: Number, required: true, default: 0 },
    totalUsed: { type: Number, required: true, default: 0 },
    totalExpired: { type: Number, required: true, default: 0 },
    totalRefunded: { type: Number, required: true, default: 0 },

    // Stored as string because values can exceed JS safe integer.
    totalRevenueWei: { type: String, required: true, default: "0" },

    lastRebuiltAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

TicketStatsSchema.index(
  { contractAddress: 1, eventId: 1 },
  { unique: true }
);

export const TicketStats =
  mongoose.models.TicketStats || mongoose.model("TicketStats", TicketStatsSchema);
