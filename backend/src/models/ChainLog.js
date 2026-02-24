import mongoose from "mongoose";

const ChainLogSchema = new mongoose.Schema(
  {
    contractName: { type: String, required: true, index: true },
    contractAddress: { type: String, required: true, index: true },

    blockNumber: { type: Number, required: true, index: true },
    blockHash: { type: String, required: true },

    transactionHash: { type: String, required: true, index: true },
    transactionIndex: { type: Number, required: true },
    logIndex: { type: Number, required: true },

    topics: { type: [String], required: true },
    data: { type: String, required: true },

    eventName: { type: String },
    args: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Idempotency key for a log in the canonical chain (txHash + logIndex is stable).
ChainLogSchema.index(
  { contractAddress: 1, transactionHash: 1, logIndex: 1 },
  { unique: true }
);

// Efficient cleanup/upserts during reorg re-processing.
ChainLogSchema.index({ contractAddress: 1, blockNumber: 1 });

export const ChainLog =
  mongoose.models.ChainLog || mongoose.model("ChainLog", ChainLogSchema);
