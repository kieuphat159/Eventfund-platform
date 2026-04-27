import mongoose from "mongoose";

const userBalanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Balance tracking (in Wei)
    totalDeposited: {
      type: String,
      default: "0",
    },

    totalWithdrawn: {
      type: String,
      default: "0",
    },

    availableBalance: {
      type: String,
      default: "0",
    },

    // Statistics
    depositCount: {
      type: Number,
      default: 0,
    },

    lastDepositAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userBalanceSchema.index({ walletAddress: 1 }, { unique: true });
userBalanceSchema.index({ userId: 1 });

const UserBalance = mongoose.model("UserBalance", userBalanceSchema);

export default UserBalance;
