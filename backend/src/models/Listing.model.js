import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const listingSchema = new mongoose.Schema({
  // On-chain listing ID (from smart contract)
  contractListingId: {
    type: String,
    index: true,
    unique: true,
    sparse: true,
  },

  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ticket",
    // not required: may be unresolved if ticket not yet indexed at listing time
  },

  tokenId: {
    type: String,
    required: true,
  },

  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    // not required: resolved from ticket lookup; may be null if ticket not yet indexed
  },

  seller: {
    type: String, // walletAddress
    required: true,
    trim: true,
    lowercase: true,
  },

  price: {
    type: String,
    required: true,
    default: "0",
  },

  maxPrice: {
    type: String, // Giới hạn giá tối đa (chống đầu cơ)
    default: "0",
  },

  listedAt: {
    type: Date,
    default: Date.now,
  },

  status: {
    type: String,
    enum: ["active", "sold", "cancelled", "expired"],
    default: "active",
  },

  txHash: {
    type: String,
    trim: true,
    lowercase: true,
  },

  expiresAt: {
    type: Date,
  },

  soldTo: {
    type: String, // walletAddress
    trim: true,
    lowercase: true,
  },

  soldAt: {
    type: Date,
  },

  soldTxHash: {
    type: String,
    trim: true,
    lowercase: true,
  },
});

// ===== Indexes =====
listingSchema.index({ status: 1, price: 1 });
listingSchema.index({ seller: 1 });
listingSchema.index({ tokenId: 1 });
listingSchema.index({ eventId: 1, status: 1 });

// Apply pagination plugin
listingSchema.plugin(mongoosePaginate);

const Listing = mongoose.model("Listing", listingSchema);

export default Listing;
