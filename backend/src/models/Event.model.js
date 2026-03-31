import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const eventSchema = new mongoose.Schema(
  {
    contractEventId: {
      type: String,
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
      trim: true,
    },

    organizer: {
      type: String, // walletAddress
      required: true,
      lowercase: true,
      trim: true,
    },

    // ===== Funding Info =====
    organizerStake: { type: String, default: "0" },
    minStakeRequired: { type: String, default: "0" },
    fundingGoal: { type: String, default: "0" },
    currentFunding: { type: String, default: "0" },
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

    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (v) {
          return !this.startDate || v > this.startDate;
        },
        message: 'End date must be after start date',
      },
    },
    venue: {
      name: String,
      address: String,
    },

    imageUrls: [String],

    metadataUri: String, // IPFS

    // ===== Ticket Info =====
    totalTickets: {
      type: Number,
      default: 0,
      min: [1, 'Total tickets must be at least 1'],
    },
    ticketsSold: { type: Number, default: 0 },
    totalTicketsUsed: { type: Number, default: 0 },
    ticketTiers: [
      {
        name: {
          type: String,
          trim: true,
          required: true,
        },
        price: {
          type: Number,
          min: 0,
          required: true,
        },
        totalSupply: {
          type: Number,
          min: 1,
          required: true,
        },
        benefits: [{ type: String, trim: true }],
      },
    ],
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

    totalRevenue: { type: String, default: "0" },
    revenueDistributedAt: Date,
  },
  {
    timestamps: true, // Auto tạo createdAt, updatedAt
  },
);

// ===== Indexes =====
eventSchema.index({ contractEventId: 1 }, { unique: true, sparse: true });
eventSchema.index({ status: 1, category: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ fundingDeadline: 1 });

// Apply pagination plugin
eventSchema.plugin(mongoosePaginate);

const Event = mongoose.model("Event", eventSchema);

export default Event;
