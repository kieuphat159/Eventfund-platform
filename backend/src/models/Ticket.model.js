import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const transferHistorySchema = new mongoose.Schema(
  {
    from: {
      type: String, // walletAddress
      trim: true,
      lowercase: true,
    },

    to: {
      type: String, // walletAddress
      trim: true,
      lowercase: true,
    },

    txHash: {
      type: String,
      trim: true,
      lowercase: true,
    },

    timestamp: {
      type: Date,
    },

    price: {
      type: String,
      default: "0",
    },

    type: {
      type: String,
      enum: ["mint", "purchase", "transfer", "resale"],
    },
  },
  { _id: false },
);

const ticketSchema = new mongoose.Schema({
  tokenId: {
    type: String,
    required: true,
    unique: true,
  },

  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },

  currentOwner: {
    type: String, // walletAddress
    required: true,
    trim: true,
    lowercase: true,
  },

  originalPrice: {
    type: String,
    required: true,
    default: "0",
  },

  ticketType: {
    type: String,
    enum: ["vip", "standard", "early_bird", "etc"],
  },

  metadataUri: {
    type: String,
  },

  // Status tracking
  status: {
    type: String,
    enum: ["minted", "sold", "used", "expired", "refunded"],
    default: "minted",
  },

  soldAt: {
    type: Date,
  },

  usedAt: {
    type: Date, // Timestamp khi vé được sử dụng
  },

  usedTxHash: {
    type: String,
    trim: true,
    lowercase: true,
  },

  refundedAt: {
    type: Date,
  },

  refundedTxHash: {
    type: String,
    trim: true,
    lowercase: true,
  },

  verifiedBy: {
    type: String, // Verifier walletAddress
    trim: true,
    lowercase: true,
  },

  // Marketplace
  isListed: {
    type: Boolean,
    default: false,
  },

  // History
  transferHistory: [transferHistorySchema],

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ===== Indexes =====
ticketSchema.index({ eventId: 1 });
ticketSchema.index({ currentOwner: 1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ isListed: 1 });
ticketSchema.index({ eventId: 1, status: 1 });

// Apply pagination plugin
ticketSchema.plugin(mongoosePaginate);

const Ticket = mongoose.model("Ticket", ticketSchema);

export default Ticket;
