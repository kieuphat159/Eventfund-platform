import mongoose from "mongoose";

const BlockchainSyncStateSchema = new mongoose.Schema(
  {
    contractName: { type: String, required: true, unique: true, index: true },
    contractAddress: { type: String, required: true, index: true },
    lastProcessedBlock: { type: Number, required: true, default: 0 },
    lastSyncAt: { type: Date },
    status: {
      type: String,
      enum: ["syncing", "synced", "error"],
      default: "synced",
      index: true,
    },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

export const BlockchainSyncState =
  mongoose.models.BlockchainSyncState ||
  mongoose.model("BlockchainSyncState", BlockchainSyncStateSchema);
