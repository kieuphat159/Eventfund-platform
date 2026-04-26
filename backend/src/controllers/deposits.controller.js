import {
  IpnSuccess,
  IpnFailChecksum,
  IpnOrderNotFound,
  IpnInvalidAmount,
  InpOrderAlreadyConfirmed,
  IpnUnknownError,
} from "vnpay";
import moment from "moment";
import VNPayService from "../services/deposits/vnpay.service.js";
import ExchangeRateService from "../services/deposits/exchangeRate.service.js";
import DepositProcessorService from "../services/deposits/depositProcessor.service.js";
import depositOrderRepo from "../repositories/depositOrder.repo.js";
import userBalanceRepo from "../repositories/userBalance.repo.js";
import logger from "../config/logger.js";
import config from "../config/env.js";
import {
  BadRequestError,
  NotFoundError,
} from "../utils/customErrors.js";

const vnpayService = new VNPayService();
const exchangeRateService = new ExchangeRateService();
const depositProcessor = new DepositProcessorService();

class DepositsController {
  /**
   * Create deposit order
   * POST /api/deposits/create
   */
  async createDepositOrder(req, res, next) {
    try {
      const { vndAmount } = req.body;
      const userId = req.user._id;
      const walletAddress = req.user.walletAddress;

      // Validate amount
      const minAmount = config.deposits.minVND;
      const maxAmount = config.deposits.maxVND;

      if (vndAmount < minAmount || vndAmount > maxAmount) {
        throw new BadRequestError(
          `Amount must be between ${minAmount} and ${maxAmount} VND`
        );
      }

      // Get exchange rate
      const exchangeRate = await exchangeRateService.getETHtoVND();

      // Calculate ETH amount
      const ethAmountWei = exchangeRateService.calculateETHAmount(
        vndAmount,
        exchangeRate
      );
      const ethAmountReadable = exchangeRateService.formatWeiToETH(ethAmountWei);

      // Generate order ID
      const orderId = `DEP_${Date.now()}_${userId.toString().slice(-6)}`;

      // Get client IP
      const ipAddress =
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.connection.remoteAddress ||
        "127.0.0.1";

      // Create order
      const order = await depositOrderRepo.create({
        orderId,
        userId,
        walletAddress,
        vndAmount,
        ethAmount: ethAmountWei,
        exchangeRate,
        status: "pending",
        expiresAt: new Date(
          Date.now() + config.deposits.expiryMinutes * 60 * 1000
        ),
        ipAddress,
        userAgent: req.headers["user-agent"],
      });

      // Create VNPay payment URL
      const vnpayUrl = vnpayService.createPaymentUrl(
        orderId,
        vndAmount,
        ipAddress,
        `Nap ${ethAmountReadable} ETH`
      );

      logger.info("Deposit order created", {
        orderId,
        userId,
        walletAddress,
        vndAmount,
        ethAmount: ethAmountWei,
        exchangeRate,
      });

      res.status(201).json({
        success: true,
        data: {
          orderId,
          vndAmount,
          ethAmount: ethAmountReadable,
          ethAmountWei,
          exchangeRate,
          expiresAt: order.expiresAt,
          vnpayUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * VNPay IPN handler
   * GET /api/deposits/vnpay-ipn
   */
  async handleVNPayIPN(req, res) {
    try {
      // 1. Verify IPN call
      const verify = vnpayService.verifyIpnCall(req.query);

      // 2. Check checksum
      if (!verify.isVerified) {
        logger.warn("VNPay IPN: Invalid checksum", { query: req.query });
        return res.json(IpnFailChecksum);
      }

      // 3. Check payment success
      if (!verify.isSuccess) {
        logger.warn("VNPay IPN: Payment failed", {
          orderId: verify.vnp_TxnRef,
          responseCode: verify.vnp_ResponseCode,
        });
        return res.json(IpnUnknownError);
      }

      // 4. Find order
      const order = await depositOrderRepo.findByOrderId(verify.vnp_TxnRef);

      if (!order || verify.vnp_TxnRef !== order.orderId) {
        logger.error("VNPay IPN: Order not found", {
          orderId: verify.vnp_TxnRef,
        });
        return res.json(IpnOrderNotFound);
      }

      // 5. Check amount (verify.vnp_Amount đã tự động chia 100)
      if (verify.vnp_Amount !== order.vndAmount) {
        logger.error("VNPay IPN: Amount mismatch", {
          orderId: order.orderId,
          expected: order.vndAmount,
          received: verify.vnp_Amount,
        });
        return res.json(IpnInvalidAmount);
      }

      // 6. Check if already confirmed
      if (order.status === "completed" || order.status === "processing") {
        logger.info("VNPay IPN: Order already confirmed", {
          orderId: order.orderId,
          status: order.status,
        });
        return res.json(InpOrderAlreadyConfirmed);
      }

      // 7. Update order status to paid
      order.status = "paid";
      order.paidAt = new Date();
      order.vndAmountPaid = verify.vnp_Amount;
      order.vnpayTransactionNo = verify.vnp_TransactionNo;
      order.vnpayBankCode = verify.vnp_BankCode;
      order.vnpayCardType = verify.vnp_CardType;
      order.vnpayPayDate = verify.vnp_PayDate
        ? moment(verify.vnp_PayDate, "YYYYMMDDHHmmss").toDate()
        : new Date();
      order.vnpaySecureHash = verify.vnp_SecureHash;

      await order.save();

      logger.info("VNPay IPN: Order confirmed", {
        orderId: order.orderId,
      });

      // 8. Return success to VNPay immediately
      res.json(IpnSuccess);

      // 9. Process deposit asynchronously (don't wait for response)
      setImmediate(async () => {
        try {
          await depositProcessor.processDeposit(order.orderId);
          logger.info("VNPay IPN: Deposit processed successfully", {
            orderId: order.orderId,
          });
        } catch (error) {
          logger.error("VNPay IPN: Deposit processing failed", {
            orderId: order.orderId,
            error: error.message,
          });
        }
      });
    } catch (error) {
      logger.error("VNPay IPN: Unknown error", {
        error: error.message,
        stack: error.stack,
      });
      return res.json(IpnUnknownError);
    }
  }

  /**
   * VNPay return URL handler
   * GET /api/deposits/vnpay-return
   */
  async handleVNPayReturn(req, res, next) {
    try {
      const verify = vnpayService.verifyReturnUrl(req.query);

      const orderId = verify.vnp_TxnRef;
      const frontendUrl = config.frontend.url;

      if (!verify.isVerified) {
        logger.warn("VNPay Return: Invalid signature", { orderId });
        return res.redirect(
          `${frontendUrl}/deposit/failed?orderId=${orderId}&reason=invalid_signature`
        );
      }

      if (!verify.isSuccess) {
        logger.warn("VNPay Return: Payment failed", {
          orderId,
          responseCode: verify.vnp_ResponseCode,
        });
        return res.redirect(
          `${frontendUrl}/deposit/failed?orderId=${orderId}&reason=payment_failed&code=${verify.vnp_ResponseCode}`
        );
      }

      logger.info("VNPay Return: Payment success", { orderId });

      // Redirect user first
      res.redirect(`${frontendUrl}/deposit/success?orderId=${orderId}`);

      // Process deposit asynchronously after redirect
      (async () => {
        try {
          const order = await depositOrderRepo.findByOrderId(orderId);

          if (!order) {
            logger.error("VNPay Return: Order not found for processing", { orderId });
            return;
          }

          // Skip if already processed
          if (order.status === "completed" || order.status === "processing") {
            logger.info("VNPay Return: Order already processed", {
              orderId,
              status: order.status,
            });
            return;
          }

          // Update order to paid status
          if (order.status === "pending") {
            order.status = "paid";
            order.paidAt = new Date();
            order.vndAmountPaid = verify.vnp_Amount;
            order.vnpayTransactionNo = verify.vnp_TransactionNo;
            order.vnpayBankCode = verify.vnp_BankCode;
            order.vnpayCardType = verify.vnp_CardType;
            order.vnpayPayDate = verify.vnp_PayDate
              ? moment(verify.vnp_PayDate, "YYYYMMDDHHmmss").toDate()
              : new Date();
            await order.save();

            logger.info("VNPay Return: Order marked as paid", { orderId });
          }

          // Process deposit (transfer ETH)
          logger.info("VNPay Return: Starting deposit processing", { orderId });
          await depositProcessor.processDeposit(orderId);
          logger.info("VNPay Return: Deposit processed successfully", {
            orderId,
          });
        } catch (error) {
          logger.error("VNPay Return: Deposit processing failed", {
            orderId,
            error: error.message,
            stack: error.stack,
          });
        }
      })();
    } catch (error) {
      logger.error("VNPay Return: Error", {
        error: error.message,
        stack: error.stack,
      });
      return res.redirect(
        `${config.frontend.url}/deposit/failed?reason=unknown_error`
      );
    }
  }

  /**
   * Get deposit order by ID
   * GET /api/deposits/:orderId
   */
  async getDepositOrder(req, res, next) {
    try {
      const { orderId } = req.params;
      const userId = req.user._id;

      const order = await depositOrderRepo.findByOrderId(orderId);

      if (!order) {
        throw new NotFoundError("Deposit order not found");
      }

      // Check ownership
      if (order.userId.toString() !== userId.toString()) {
        throw new NotFoundError("Deposit order not found");
      }

      res.json({
        success: true,
        data: {
          orderId: order.orderId,
          status: order.status,
          vndAmount: order.vndAmount,
          ethAmount: exchangeRateService.formatWeiToETH(order.ethAmount),
          ethAmountWei: order.ethAmount,
          exchangeRate: order.exchangeRate,
          transferTxHash: order.transferTxHash,
          transferBlockNumber: order.transferBlockNumber,
          createdAt: order.createdAt,
          paidAt: order.paidAt,
          completedAt: order.completedAt,
          expiresAt: order.expiresAt,
          errorMessage: order.errorMessage,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get deposit history
   * GET /api/deposits/history
   */
  async getDepositHistory(req, res, next) {
    try {
      const userId = req.user._id;
      const { page = 1, limit = 20, status } = req.query;

      const result = await depositOrderRepo.findByUserId(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
      });

      const deposits = result.docs.map((order) => ({
        orderId: order.orderId,
        status: order.status,
        vndAmount: order.vndAmount,
        ethAmount: exchangeRateService.formatWeiToETH(order.ethAmount),
        ethAmountWei: order.ethAmount,
        exchangeRate: order.exchangeRate,
        transferTxHash: order.transferTxHash,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        completedAt: order.completedAt,
      }));

      res.json({
        success: true,
        data: {
          deposits,
          pagination: {
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
            totalDocs: result.totalDocs,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current exchange rate
   * GET /api/deposits/exchange-rate
   */
  async getExchangeRate(req, res, next) {
    try {
      const rate = await exchangeRateService.getETHtoVND();

      res.json({
        success: true,
        data: {
          currency: "ETH",
          vndRate: rate,
          lastUpdated: new Date(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user balance
   * GET /api/deposits/balance
   */
  async getUserBalance(req, res, next) {
    try {
      const walletAddress = req.user.walletAddress;

      const balance = await userBalanceRepo.findByWalletAddress(walletAddress);

      if (!balance) {
        return res.json({
          success: true,
          data: {
            walletAddress,
            totalDeposited: "0",
            totalWithdrawn: "0",
            availableBalance: "0",
            depositCount: 0,
            lastDepositAt: null,
          },
        });
      }

      res.json({
        success: true,
        data: {
          walletAddress: balance.walletAddress,
          totalDeposited: exchangeRateService.formatWeiToETH(
            balance.totalDeposited
          ),
          totalWithdrawn: exchangeRateService.formatWeiToETH(
            balance.totalWithdrawn
          ),
          availableBalance: exchangeRateService.formatWeiToETH(
            balance.availableBalance
          ),
          totalDepositedWei: balance.totalDeposited,
          totalWithdrawnWei: balance.totalWithdrawn,
          availableBalanceWei: balance.availableBalance,
          depositCount: balance.depositCount,
          lastDepositAt: balance.lastDepositAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get relayer balance (admin only)
   * GET /api/deposits/relayer-balance
   */
  async getRelayerBalance(req, res, next) {
    try {
      const balanceWei = await depositProcessor.getRelayerBalance();
      const balanceETH = exchangeRateService.formatWeiToETH(balanceWei);

      res.json({
        success: true,
        data: {
          balanceWei,
          balanceETH,
          address: depositProcessor.relayerWallet.address,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new DepositsController();
