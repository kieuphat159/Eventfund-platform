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
    type: Number, // Stake ban đầu
    required: true,
  },

  penaltyAmount: {
    type: Number, // Số tiền bị phạt
    required: true,
  },

  penaltyPercentage: {
    type: Number, // Tỷ lệ phạt
    required: true,
  },

  reason: {
    type: String,
    enum: ["cancelled", "fraud", "threshold_not_met"],
    required: true,
  },

  txHash: {
    type: String,
    trim: true,
    lowercase: true,
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
