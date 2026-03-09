import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    contractEventId: {
      type: String,
      required: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: String,

    category: {
      type: String,
      required: true,
      trim: true,
    },

    organizer: {
      type: String, // walletAddress
      required: true,
      lowercase: true,
      trim: true,
    },

    // ===== Funding Info =====
    organizerStake: { type: Number, default: 0 },
    minStakeRequired: { type: Number, default: 0 },
    fundingGoal: { type: Number, default: 0 },
    currentFunding: { type: Number, default: 0 },
    fundingDeadline: Date,

    // ===== Event Info =====
    status: {
      type: String,
      enum: [
        "draft",
        "funding",
        "funded",
        "ticketing",
        "ongoing",
        "completed",
        "cancelled",
        "failed",
      ],
      default: "draft",
    },

    startDate: Date,
    endDate: Date,
    venue: String,

    imageUrls: [String],

    metadataUri: String, // IPFS

    // ===== Ticket Info =====
    totalTickets: { type: Number, default: 0 },
    ticketsSold: { type: Number, default: 0 },
    totalTicketsUsed: { type: Number, default: 0 },
    ticketUsageThreshold: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // ===== Revenue Info =====
    escrowStatus: {
      type: String,
      enum: ["holding", "released", "refunded"],
      default: "holding",
    },

    totalRevenue: { type: Number, default: 0 },
    revenueDistributedAt: Date,
  },
  {
    timestamps: true, // Auto tạo createdAt, updatedAt
  },
);

// ===== Indexes =====
eventSchema.index({ contractEventId: 1 }, { unique: true });
eventSchema.index({ status: 1, category: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ fundingDeadline: 1 });

const Event = mongoose.model("Event", eventSchema);

export default Event;
