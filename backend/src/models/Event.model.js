import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const eventSchema = new mongoose.Schema(
  {
    // ===== Identity =====
    contractEventId: {
      type: String,
      trim: true,
    },

    fundContractAddress: {
      type: String,
      lowercase: true,
      trim: true,
    },

    // ===== Basic Info =====
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
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    onChainOrganizer: {
      type: String,
      lowercase: true,
      trim: true,
    },

    // ===== Funding =====
    organizerStake: { type: String, default: "0" },
    minStakeRequired: { type: String, default: "0" },
    minInvestmentAmount: { type: String, default: "0" },
    fundingGoal: { type: String, default: "0" },
    currentFunding: { type: String, default: "0" },

    organizerShareBps: { type: Number, default: 0 },
    investmentEnabled: { type: Boolean, default: true },
    fundingDeadline: {
      type: Date,
    },

    ticketPrice: { type: Number, default: 0 },
    maxTickets: { type: Number, default: 0 },
    usedThreshold: { type: Number, default: 0 },

    // ===== Lifecycle timestamps =====
    fundingFinalizedAt: { type: Date },

    // ===== Ticketing (NEW) =====
    ticketingStartAt: { type: Date },
    ticketingEndAt: {
      type: Date,
      validate: {
        validator: function (v) {
          if (!v || !this.ticketingStartAt) return true;
          return v > this.ticketingStartAt;
        },
        message: "ticketingEndAt must be after ticketingStartAt",
      },
    },

    // ===== Event Time =====
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
        message: "End date must be after start date",
      },
    },

    completedAt: { type: Date },

    // ===== Status =====
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

    cancellationReason: {
      type: String,
      enum: [
        "funding_goal_not_met",
        "organizer_cancelled",
        "ticket_sales_not_met",
      ],
    },

    cancellationNote: {
      type: String,
      trim: true,
    },

    cancelledAt: { type: Date },

    cancelledBy: {
      type: String,
      lowercase: true,
      trim: true,
    },

    // ===== Access Control =====
    verifiers: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],

    // ===== Venue =====
    venue: {
      address: String,
    },

    imageUrls: [String],
    metadataUri: String,

    // ===== Ticket Info =====
    totalTickets: {
      type: Number,
      default: 1,
      min: [1, "Total tickets must be at least 1"],
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

    // ===== Revenue / Escrow =====
    escrowStatus: {
      type: String,
      enum: [
        "holding",
        "holding_revenue",
        "released",
        "refund_enabled",
        "refunding",
        "refund_pool_funded",
        "refunded",
      ],
      default: "holding",
    },

    totalRevenue: { type: String, default: "0" },
    escrowedRevenue: { type: String, default: "0" },
    platformFee: { type: String, default: "0" },
    organizerShare: { type: String, default: "0" },
    donatorPool: { type: String, default: "0" },

    // ===== Refund =====
    refundPool: { type: String, default: "0" },
    refundedAmount: { type: Number, default: 0 },
    refundEnabledAt: { type: Date },
    lastRefundedAt: { type: Date },
    lastRefundPoolDepositAt: { type: Date },
    extraRefundPoolDeposited: { type: Number, default: 0 },

    // ===== Revenue Tracking =====
    ticketRevenueDeposited: { type: Number, default: 0 },
    lastTicketRevenueAt: { type: Date },

    royaltyRevenueDeposited: { type: Number, default: 0 },
    lastRoyaltyRevenueAt: { type: Date },

    // ===== Contribution Refund =====
    lastContributionRefundAt: { type: Date },

    // ===== Organizer Stake =====
    organizerStakeWithdrawn: { type: String, default: "0" },
    stakeWithdrawnAt: { type: Date },

    // ===== Penalty =====
    totalPenaltyAmount: { type: Number, default: 0 },
    lastPenaltyAt: { type: Date },

    // ===== Flags =====
    revenueReleased: { type: Boolean, default: false },
    refundsEnabled: { type: Boolean, default: false },
    sharesFinalized: { type: Boolean, default: false },

    totalShares: { type: String, default: "0" },
    totalMinted: { type: Number, default: 0 },

    // ===== Idempotency =====
    processedTxHashes: {
      type: [{ txHash: String, field: String }],
      default: [],
      _id: false,
    },
  },
  {
    timestamps: true,
  },
);

// ===== GLOBAL TIMELINE VALIDATION =====
eventSchema.pre("save", function () {
  // fundingDeadline < ticketingStartAt
  if (this.ticketingStartAt && this.fundingDeadline) {
    if (this.ticketingStartAt <= this.fundingDeadline) {
      throw new Error("ticketingStartAt must be after fundingDeadline");
    }
  }

  // ticketingEndAt < startDate
  if (this.ticketingEndAt && this.startDate) {
    if (this.ticketingEndAt >= this.startDate) {
      throw new Error("ticketingEndAt must be before event startDate");
    }
  }
});

// ===== Indexes =====
eventSchema.index({ contractEventId: 1 });
eventSchema.index(
  { fundContractAddress: 1, contractEventId: 1 },
  { unique: true, sparse: true },
);
eventSchema.index({ status: 1, category: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ fundingDeadline: 1 });

// ===== Plugin =====
eventSchema.plugin(mongoosePaginate);

const Event = mongoose.model("Event", eventSchema);

export default Event;
