import mongoose from "mongoose";

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
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
  },
);

// Index theo yêu cầu: { walletAddress: 1 }
userSchema.index({ walletAddress: 1 }, { unique: true });

const User = mongoose.model("User", userSchema);

export default User;
