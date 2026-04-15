import mongoose from "mongoose";

const revenueDistributionSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },

  // Revenue breakdown
  totalRevenue: {
    type: String,
    required: true,
    default: "0",
  },

  platformFee: {
    type: String, // Phí sàn (vd: 5%)
    required: true,
    default: "0",
  },

  platformFeePercentage: {
    type: Number,
    required: true,
  },

  organizerShare: {
    type: String, // Phần của organizer
    required: true,
    default: "0",
  },

  organizerSharePercentage: {
    type: Number,
    required: true,
  },

  donatorPool: {
    type: String, // Pool chia cho donators
    required: true,
    default: "0",
  },

  accRewardPerShare: {
    type: String,
    default: "0",
  },

  // Accumulated reward per share snapshot at distribution time
  accRewardPerShare: {
    type: Number,
    default: 0,
  },

  // Distribution status
  status: {
    type: String,
    enum: ["pending", "distributing", "completed", "failed"],
    default: "pending",
  },

  triggeredAt: {
    type: Date,
  },

  completedAt: {
    type: Date,
  },

  txHash: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true,
  },

  // Trigger info
  ticketUsageRatio: {
    type: Number, // Tỷ lệ vé đã dùng khi trigger
  },

  triggerType: {
    type: String,
    enum: ["threshold_reached", "manual", "expired"],
  },
});

// ===== Indexes =====
revenueDistributionSchema.index({ eventId: 1 });
revenueDistributionSchema.index({ status: 1 });

const RevenueDistribution = mongoose.model(
  "RevenueDistribution",
  revenueDistributionSchema,
);

export default RevenueDistribution;
