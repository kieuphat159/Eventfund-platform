import UserBalance from "../models/UserBalance.model.js";

class UserBalanceRepository {
  /**
   * Find balance by wallet address
   */
  async findByWalletAddress(walletAddress) {
    return await UserBalance.findOne({
      walletAddress: walletAddress.toLowerCase(),
    });
  }

  /**
   * Find balance by user ID
   */
  async findByUserId(userId) {
    return await UserBalance.findOne({ userId });
  }

  /**
   * Create or update balance
   */
  async upsert(walletAddress, userId, balanceData) {
    return await UserBalance.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase() },
      {
        userId,
        ...balanceData,
      },
      {
        new: true,
        upsert: true,
      }
    );
  }

  /**
   * Get all balances with pagination
   */
  async findAll(options = {}) {
    const { page = 1, limit = 20 } = options;

    const skip = (page - 1) * limit;

    const [balances, total] = await Promise.all([
      UserBalance.find().sort({ totalDeposited: -1 }).skip(skip).limit(limit),
      UserBalance.countDocuments(),
    ]);

    return {
      balances,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export default new UserBalanceRepository();
