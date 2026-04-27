import express from "express";
import depositsController from "../controllers/deposits.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/roles.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { depositSchemas } from "../validators/deposit.validator.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Deposits
 *   description: VND to ETH deposit management
 */

/**
 * @swagger
 * /deposits/create:
 *   post:
 *     summary: Create a new deposit order
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vndAmount
 *             properties:
 *               vndAmount:
 *                 type: number
 *                 minimum: 100000
 *                 maximum: 50000000
 *                 example: 500000
 *     responses:
 *       201:
 *         description: Deposit order created successfully
 *       400:
 *         description: Invalid amount
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/create",
  authenticate,
  validate({ body: depositSchemas.createDeposit }),
  depositsController.createDepositOrder
);

/**
 * @swagger
 * /deposits/vnpay-ipn:
 *   get:
 *     summary: VNPay IPN callback (webhook)
 *     tags: [Deposits]
 *     parameters:
 *       - in: query
 *         name: vnp_TxnRef
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: vnp_Amount
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: vnp_SecureHash
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: IPN processed
 */
router.get("/vnpay-ipn", depositsController.handleVNPayIPN);

/**
 * @swagger
 * /deposits/vnpay-return:
 *   get:
 *     summary: VNPay return URL (user redirect)
 *     tags: [Deposits]
 *     parameters:
 *       - in: query
 *         name: vnp_TxnRef
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: vnp_SecureHash
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get("/vnpay-return", depositsController.handleVNPayReturn);

/**
 * @swagger
 * /deposits/{orderId}:
 *   get:
 *     summary: Get deposit order by ID
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         schema:
 *           type: string
 *         required: true
 *         example: DEP_1714123456789_abc123
 *     responses:
 *       200:
 *         description: Deposit order details
 *       404:
 *         description: Order not found
 */
router.get("/:orderId", authenticate, depositsController.getDepositOrder);

/**
 * @swagger
 * /deposits/history:
 *   get:
 *     summary: Get deposit history
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, paid, processing, completed, failed, expired]
 *     responses:
 *       200:
 *         description: Deposit history
 */
router.get("/", authenticate, depositsController.getDepositHistory);

/**
 * @swagger
 * /deposits/exchange-rate:
 *   get:
 *     summary: Get current ETH/VND exchange rate
 *     tags: [Deposits]
 *     responses:
 *       200:
 *         description: Current exchange rate
 */
router.get("/rate/exchange-rate", depositsController.getExchangeRate);

/**
 * @swagger
 * /deposits/balance:
 *   get:
 *     summary: Get user balance
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User balance details
 */
router.get("/user/balance", authenticate, depositsController.getUserBalance);

/**
 * @swagger
 * /deposits/relayer-balance:
 *   get:
 *     summary: Get relayer wallet balance (admin only)
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Relayer balance
 *       403:
 *         description: Forbidden
 */
router.get(
  "/admin/relayer-balance",
  authenticate,
  requireRole(["admin"]),
  depositsController.getRelayerBalance
);

export default router;
