import mongoose from "mongoose";

const contributionSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },

  contributor: {
    type: String, // walletAddress
    required: true,
    trim: true,
    lowercase: true,
  },

  type: {
    type: String,
    enum: ["organizer_stake", "donator_contribution"],
    required: true,
  },

  amount: {
    type: String,
    required: true,
    default: "0",
  },

  sharePercentage: {
    type: Number, // % cổ phần nhận được
    default: 0,
  },

  shareTokenId: {
    type: String, // ERC-1155 token ID (nếu có)
  },

  txHash: {
    type: String,
    required: true,
    lowercase: true,
    unique: true,
    trim: true,
  },

  blockNumber: {
    type: Number,
  },

  timestamp: {
    type: Date,
  },

  status: {
    type: String,
    enum: ["pending", "confirmed", "refunded"],
    default: "pending",
  },

  refundedAt: {
    type: Date,
  },
});

// ===== Indexes =====
contributionSchema.index({ eventId: 1 });
contributionSchema.index({ contributor: 1 });
contributionSchema.index({ type: 1, eventId: 1 });

const Contribution = mongoose.model("Contribution", contributionSchema);

export default Contribution;
