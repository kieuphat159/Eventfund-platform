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
    organizerShareBps: { type: Number, default: 0 },
    fundingDeadline: Date,

    // On-chain funding params (from EventCreated)
    organizerShareBps: { type: Number, default: 0 },
    ticketPrice: { type: Number, default: 0 },
    maxTickets: { type: Number, default: 0 },
    usedThreshold: { type: Number, default: 0 },

    // Funding lifecycle timestamps
    fundingFinalizedAt: { type: Date },
    ticketingStartedAt: { type: Date },
    completedAt: { type: Date },

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
      address: String,
    },

    imageUrls: [String],

    metadataUri: String, // IPFS

    // ===== Ticket Info =====
    totalTickets: {
      type: Number,
      default: 1,
      min: [1, 'Total tickets cannot be negative'],
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
    refundedAmount: { type: String, default: "0" },
    totalPenaltyAmount: { type: String, default: "0" },
    ticketRevenueDeposited: { type: String, default: "0" },
    royaltyRevenueDeposited: { type: String, default: "0" },
    organizerStakeWithdrawn: { type: String, default: "0" },
    revenueReleased: { type: Boolean, default: false },
    refundsEnabled: { type: Boolean, default: false },
    sharesFinalized: { type: Boolean, default: false },
    totalShares: { type: String, default: "0" },
    totalMinted: { type: Number, default: 0 },
    refundPool: { type: String, default: "0" },
    fundingFinalizedAt: Date,
    ticketingStartedAt: Date,
    completedAt: Date,
    refundEnabledAt: Date,
    lastRefundedAt: Date,
    lastRefundPoolDepositAt: Date,
    lastPenaltyAt: Date,
    lastTicketRevenueAt: Date,
    lastRoyaltyRevenueAt: Date,
    lastContributionRefundAt: Date,
    stakeWithdrawnAt: Date,
    revenueDistributedAt: Date,

    // Refund tracking
    refundPool: { type: Number, default: 0 },
    refundedAmount: { type: Number, default: 0 },
    refundEnabledAt: { type: Date },
    lastRefundedAt: { type: Date },
    lastRefundPoolDepositAt: { type: Date },
    extraRefundPoolDeposited: { type: Number, default: 0 },

    // Escrow revenue tracking
    escrowedRevenue: { type: Number, default: 0 },
    lastTicketRevenueAt: { type: Date },
    ticketRevenueDeposited: { type: Number, default: 0 },
    lastRoyaltyRevenueAt: { type: Date },
    royaltyRevenueDeposited: { type: Number, default: 0 },

    // Contribution refund tracking
    lastContributionRefundAt: { type: Date },

    // Organizer stake withdrawal
    organizerStakeWithdrawn: { type: Number, default: 0 },
    stakeWithdrawnAt: { type: Date },

    // Penalty tracking
    totalPenaltyAmount: { type: Number, default: 0 },
    lastPenaltyAt: { type: Date },

    // Idempotency: track txHashes da xu ly cac delta $inc
    // Moi phan tu: { txHash, field } de biet tx nao da duoc $inc vao field nao
    processedTxHashes: {
      type: [{ txHash: String, field: String }],
      default: [],
      _id: false,
    },
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
