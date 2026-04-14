import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const rewardClaimSchema = new mongoose.Schema({
  distributionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RevenueDistribution",
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
    default: 0,
  },

  rewardAmount: {
    type: String,
    required: true,
    default: "0",
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

// Apply pagination plugin used by reward repository methods
rewardClaimSchema.plugin(mongoosePaginate);

const RewardClaim = mongoose.model("RewardClaim", rewardClaimSchema);

export default RewardClaim;
