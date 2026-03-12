import mongoose from "mongoose";

const TicketEventSchema = new mongoose.Schema(
  {
    contractAddress: { type: String, required: true, index: true },

    blockNumber: { type: Number, required: true, index: true },
    blockHash: { type: String, required: true },

    transactionHash: { type: String, required: true, index: true },
    transactionIndex: { type: Number, required: true },
    logIndex: { type: Number, required: true },

    eventName: { type: String, required: true, index: true },

    // Common query fields (store as strings to avoid JS precision issues)
    eventId: { type: String, index: true },
    tokenId: { type: String, index: true },

    // TicketMintedBatch
    organizer: { type: String, index: true },
    ticketIds: { type: [String] },
    ticketType: { type: Number },

    // TicketPurchased
    buyer: { type: String, index: true },
    priceWei: { type: String },

    // TicketUsed
    owner: { type: String, index: true },
    verifier: { type: String, index: true },
    usedAt: { type: String },

    // TicketRefunded
    refundAmountWei: { type: String },

    // ERC721 Transfer
    from: { type: String, index: true },
    to: { type: String, index: true },

    rawArgs: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

TicketEventSchema.index(
  { contractAddress: 1, transactionHash: 1, logIndex: 1 },
  { unique: true }
);

TicketEventSchema.index({ contractAddress: 1, blockNumber: 1 });

export const TicketEvent =
  mongoose.models.TicketEvent || mongoose.model("TicketEvent", TicketEventSchema);
