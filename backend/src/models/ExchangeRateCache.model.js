import mongoose from "mongoose";

const exchangeRateCacheSchema = new mongoose.Schema(
  {
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    vndRate: {
      type: Number,
      required: true,
      min: 0,
    },

    source: {
      type: String,
      required: true,
      default: "coingecko",
    },

    fetchedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    // Metadata (optional)
    high24h: {
      type: Number,
      default: null,
    },

    low24h: {
      type: Number,
      default: null,
    },

    change24h: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: false,
  }
);

// Indexes
exchangeRateCacheSchema.index({ currency: 1, expiresAt: -1 });
exchangeRateCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

const ExchangeRateCache = mongoose.model(
  "ExchangeRateCache",
  exchangeRateCacheSchema
);

export default ExchangeRateCache;
