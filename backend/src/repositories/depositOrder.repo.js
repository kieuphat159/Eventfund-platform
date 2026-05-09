import DepositOrder from "../models/DepositOrder.model.js";

class DepositOrderRepository {
  /**
   * Create a new deposit order
   */
  async create(orderData) {
    const order = new DepositOrder(orderData);
    return await order.save();
  }

  /**
   * Find order by ID
   */
  async findByOrderId(orderId) {
    return await DepositOrder.findOne({ orderId });
  }

  /**
   * Find order by MongoDB _id
   */
  async findById(id) {
    return await DepositOrder.findById(id);
  }

  /**
   * Find orders by user ID with pagination
   */
  async findByUserId(userId, options = {}) {
    const { page = 1, limit = 20, status } = options;

    const query = { userId };
    if (status) {
      query.status = status;
    }

    return await DepositOrder.paginate(query, {
      page,
      limit,
      sort: { createdAt: -1 },
      populate: "userId",
    });
  }

  /**
   * Find orders by wallet address with pagination
   */
  async findByWalletAddress(walletAddress, options = {}) {
    const { page = 1, limit = 20, status } = options;

    const query = { walletAddress: walletAddress.toLowerCase() };
    if (status) {
      query.status = status;
    }

    return await DepositOrder.paginate(query, {
      page,
      limit,
      sort: { createdAt: -1 },
    });
  }

  /**
   * Update order status
   */
  async updateStatus(orderId, status, additionalData = {}) {
    return await DepositOrder.findOneAndUpdate(
      { orderId },
      { status, ...additionalData },
      { new: true }
    );
  }

  /**
   * Find expired orders
   */
  async findExpiredOrders() {
    return await DepositOrder.find({
      status: "pending",
      expiresAt: { $lt: new Date() },
    });
  }

  /**
   * Mark expired orders
   */
  async markExpiredOrders() {
    const result = await DepositOrder.updateMany(
      {
        status: "pending",
        expiresAt: { $lt: new Date() },
      },
      {
        status: "expired",
      }
    );

    return result.modifiedCount;
  }

  /**
   * Get order statistics
   */
  async getStatistics(userId) {
    const stats = await DepositOrder.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalVND: { $sum: "$vndAmount" },
        },
      },
    ]);

    return stats;
  }
}

export default new DepositOrderRepository();
