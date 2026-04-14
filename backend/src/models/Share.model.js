import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

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
      type: String, // Tổng số tiền đã góp
      required: true,
      default: "0",
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
      type: String, // Số tiền đã claim
      default: "0",
    },

    pendingReward: {
      type: String, // Số tiền chờ claim
      default: "0",
    },

    mintedShares: {
      type: String,
      default: "0",
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

// Apply pagination plugin used by share repository methods
shareSchema.plugin(mongoosePaginate);

const Share = mongoose.model("Share", shareSchema);
export default Share;
