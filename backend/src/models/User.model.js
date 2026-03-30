import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const userSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    username: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },

    avatarUrl: {
      type: String,
    },

    role: {
      type: String,
      enum: ["user", "organizer", "verifier", "admin"],
      default: "user",
    },

    nonce: {
      type: String,
      default: null,
    },

    nonceExpiresAt: {
      type: Date,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Smart Account address (ERC-4337) — set by frontend, verified by backend
    smartAccountAddress: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },

    chainId: {
      type: String,
      default: null,
    },

    walletCreatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
  },
);

// Index theo yêu cầu: { walletAddress: 1 }
userSchema.index({ walletAddress: 1 }, { unique: true });

// Apply pagination plugin
userSchema.plugin(mongoosePaginate);

const User = mongoose.model("User", userSchema);

export default User;
