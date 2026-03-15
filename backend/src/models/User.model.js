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
      required: true,
    },

    nonceExpiresAt: {
      type: Date,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
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
