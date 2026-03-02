import mongoose from "mongoose";

const blockchainSyncStateSchema = new mongoose.Schema({
  contractName: {
    type: String,
    required: true,
  },

  contractAddress: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },

  lastProcessedBlock: {
    type: Number,
    required: true,
  },

  lastSyncAt: {
    type: Date,
  },

  status: {
    type: String,
    enum: ["syncing", "synced", "error"],
    default: "syncing",
  },

  errorMessage: {
    type: String,
  },
});

const BlockchainSyncState = mongoose.model(
  "BlockchainSyncState",
  blockchainSyncStateSchema,
);

export default BlockchainSyncState;
