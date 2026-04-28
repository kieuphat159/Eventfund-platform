import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const depositOrderSchema = new mongoose.Schema(
  {
    // Order identification
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    walletAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // Fiat info
    vndAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    vndAmountPaid: {
      type: Number, // Số tiền thực tế user trả (có thể khác do phí VNPay)
      default: null,
    },

    // Crypto info
    ethAmount: {
      type: String, // Wei format
      required: true,
    },

    exchangeRate: {
      type: Number, // VND/ETH tại thời điểm tạo đơn
      required: true,
    },

    // VNPay info
    vnpayTransactionNo: {
      type: String,
      default: null,
    },

    vnpayBankCode: {
      type: String,
      default: null,
    },

    vnpayCardType: {
      type: String,
      default: null,
    },

    vnpayPayDate: {
      type: Date,
      default: null,
    },

    vnpaySecureHash: {
      type: String,
      default: null,
    },

    // Status tracking
    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "processing",
        "completed",
        "failed",
        "expired",
        "refunded",
      ],
      default: "pending",
    },

    // Blockchain info
    transferTxHash: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },

    transferBlockNumber: {
      type: Number,
      default: null,
    },

    transferredAt: {
      type: Date,
      default: null,
    },

    // Timestamps
    expiresAt: {
      type: Date,
      required: true,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    // Error tracking
    errorMessage: {
      type: String,
      default: null,
    },

    retryCount: {
      type: Number,
      default: 0,
    },

    // Metadata
    ipAddress: {
      type: String,
      default: null,
    },

    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Indexes
depositOrderSchema.index({ orderId: 1 }, { unique: true });
depositOrderSchema.index({ userId: 1, createdAt: -1 });
depositOrderSchema.index({ walletAddress: 1, createdAt: -1 });
depositOrderSchema.index({ status: 1, createdAt: -1 });
depositOrderSchema.index({ expiresAt: 1 }); // For TTL cleanup

// Apply pagination plugin
depositOrderSchema.plugin(mongoosePaginate);

const DepositOrder = mongoose.model("DepositOrder", depositOrderSchema);

export default DepositOrder;
