import mongoose from "mongoose";

const rewardClaimSchema = new mongoose.Schema({
  distributionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RevenueDistribution",
    required: true,
  },

  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },

  claimer: {
    type: String, // walletAddress
    required: true,
    trim: true,
    lowercase: true,
  },

  sharePercentage: {
    type: Number,
    required: true,
  },

  rewardAmount: {
    type: Number,
    required: true,
  },

  txHash: {
    type: String,
    trim: true,
    lowercase: true,
  },

  claimedAt: {
    type: Date,
  },

  status: {
    type: String,
    enum: ["pending", "confirmed", "failed"],
    default: "pending",
  },
});

// ===== Indexes =====
rewardClaimSchema.index({ eventId: 1 });
rewardClaimSchema.index({ claimer: 1 });
rewardClaimSchema.index({ distributionId: 1 });

const RewardClaim = mongoose.model("RewardClaim", rewardClaimSchema);

export default RewardClaim;
