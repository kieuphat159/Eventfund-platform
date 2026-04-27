import { ethers } from "ethers";
import DepositOrder from "../../models/DepositOrder.model.js";
import UserBalance from "../../models/UserBalance.model.js";
import logger from "../../config/logger.js";
import config from "../../config/env.js";

class DepositProcessorService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
    this.relayerWallet = new ethers.Wallet(
      config.blockchain.relayerPrivateKey,
      this.provider
    );

    logger.info("DepositProcessorService initialized", {
      relayerAddress: this.relayerWallet.address,
    });
  }

  /**
   * Process a paid deposit order
   * @param {string} orderId - Order ID
   * @returns {Promise<object>} Transaction receipt
   */
  async processDeposit(orderId) {
    const order = await DepositOrder.findOne({ orderId });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (order.status !== "paid") {
      throw new Error(
        `Order status is not 'paid': ${orderId} (status: ${order.status})`
      );
    }

    try {
      // Update status to processing
      order.status = "processing";
      await order.save();

      logger.info("Processing deposit", {
        orderId,
        walletAddress: order.walletAddress,
        ethAmount: order.ethAmount,
      });

      // Check relayer balance
      const relayerBalance = await this.provider.getBalance(
        this.relayerWallet.address
      );

      if (relayerBalance < BigInt(order.ethAmount)) {
        throw new Error(
          `Insufficient relayer balance. Required: ${order.ethAmount}, Available: ${relayerBalance}`
        );
      }

      // Send ETH to user wallet
      const tx = await this.relayerWallet.sendTransaction({
        to: order.walletAddress,
        value: order.ethAmount, // Wei format
      });

      logger.info("Deposit transaction sent", {
        orderId,
        txHash: tx.hash,
        to: order.walletAddress,
        value: order.ethAmount,
      });

      // Wait for confirmation (1 block)
      const receipt = await tx.wait(1);

      if (receipt.status !== 1) {
        throw new Error(`Transaction failed on-chain: ${tx.hash}`);
      }

      // Update order status
      order.status = "completed";
      order.transferTxHash = receipt.hash;
      order.transferBlockNumber = receipt.blockNumber;
      order.transferredAt = new Date();
      order.completedAt = new Date();
      await order.save();

      // Update user balance
      await this.updateUserBalance(order);

      logger.info("Deposit completed successfully", {
        orderId,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return receipt;
    } catch (error) {
      // Update order status to failed
      order.status = "failed";
      order.errorMessage = error.message;
      order.retryCount = (order.retryCount || 0) + 1;
      await order.save();

      logger.error("Deposit processing failed", {
        orderId,
        error: error.message,
        stack: error.stack,
        retryCount: order.retryCount,
      });

      throw error;
    }
  }

  /**
   * Update user balance after successful deposit
   * @param {object} order - Deposit order
   */
  async updateUserBalance(order) {
    try {
      let balance = await UserBalance.findOne({
        walletAddress: order.walletAddress,
      });

      if (!balance) {
        balance = new UserBalance({
          userId: order.userId,
          walletAddress: order.walletAddress,
          totalDeposited: "0",
          totalWithdrawn: "0",
          availableBalance: "0",
          depositCount: 0,
        });
      }

      // Update balances (BigInt arithmetic)
      balance.totalDeposited = (
        BigInt(balance.totalDeposited) + BigInt(order.ethAmount)
      ).toString();

      balance.availableBalance = (
        BigInt(balance.availableBalance) + BigInt(order.ethAmount)
      ).toString();

      balance.depositCount += 1;
      balance.lastDepositAt = new Date();

      await balance.save();

      logger.info("User balance updated", {
        walletAddress: order.walletAddress,
        totalDeposited: balance.totalDeposited,
        availableBalance: balance.availableBalance,
        depositCount: balance.depositCount,
      });
    } catch (error) {
      logger.error("Failed to update user balance", {
        orderId: order.orderId,
        walletAddress: order.walletAddress,
        error: error.message,
      });
      // Don't throw - balance update failure shouldn't fail the deposit
    }
  }

  /**
   * Get relayer wallet balance
   * @returns {Promise<string>} Balance in Wei
   */
  async getRelayerBalance() {
    const balance = await this.provider.getBalance(this.relayerWallet.address);
    return balance.toString();
  }
}

export default DepositProcessorService;
