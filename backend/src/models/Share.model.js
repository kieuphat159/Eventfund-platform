import mongoose from "mongoose";

const shareSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    holder: {
      type: String, // walletAddress
      required: true,
      trim: true,
      lowercase: true,
    },

    contributionAmount: {
      type: Number, // Tổng số tiền đã góp
      required: true,
      default: 0,
    },

    sharePercentage: {
      type: Number, // Tỷ lệ % cổ phần
      required: true,
      default: 0,
    },

    shareTokenId: {
      type: String, // Token ID (nếu dùng ERC-20/ERC-1155)
    },

    claimedReward: {
      type: Number, // Số tiền đã claim
      default: 0,
    },

    pendingReward: {
      type: Number, // Số tiền chờ claim
      default: 0,
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
  },
);

// ===== Indexes =====
shareSchema.index({ eventId: 1 });
shareSchema.index({ holder: 1 });
shareSchema.index({ eventId: 1, holder: 1 }, { unique: true });

const Share = mongoose.model("Share", shareSchema);

export default Share;
