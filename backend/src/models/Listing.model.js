import mongoose from "mongoose";

const listingSchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ticket",
    required: true,
  },

  tokenId: {
    type: String,
    required: true,
  },

  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },

  seller: {
    type: String, // walletAddress
    required: true,
    trim: true,
    lowercase: true,
  },

  price: {
    type: Number,
    required: true,
  },

  maxPrice: {
    type: Number, // Giới hạn giá tối đa (chống đầu cơ)
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

const Listing = mongoose.model("Listing", listingSchema);

export default Listing;
