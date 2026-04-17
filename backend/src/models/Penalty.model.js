import mongoose from "mongoose";

const penaltySchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },

  organizer: {
    type: String, // walletAddress
    required: true,
    trim: true,
    lowercase: true,
  },

  stakeAmount: {
    type: String, // Stake ban đầu
    required: true,
    default: "0",
  },

  penaltyAmount: {
    type: String, // Số tiền bị phạt
    required: true,
    default: "0",
  },

  penaltyPercentage: {
    type: Number, // Tỷ lệ phạt
    required: true,
  },

  reason: {
    type: String,
    enum: ["cancelled", "fraud", "threshold_not_met", "unknown"],
    required: true,
  },

  penaltyBps: {
    type: Number,
    default: 0,
  },

  txHash: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true,
  },

  processedAt: {
    type: Date,
  },

  status: {
    type: String,
    enum: ["pending", "processed"],
    default: "pending",
  },
});

// ===== Indexes =====
penaltySchema.index({ eventId: 1 });
penaltySchema.index({ organizer: 1 });

const Penalty = mongoose.model("Penalty", penaltySchema);

export default Penalty;
