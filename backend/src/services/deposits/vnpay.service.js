import { VNPay, ProductCode, VnpLocale } from "vnpay";
import config from "../../config/env.js";
import logger from "../../config/logger.js";

class VNPayService {
  constructor() {
    this.vnpay = new VNPay({
      tmnCode: config.vnpay.tmnCode,
      secureSecret: config.vnpay.hashSecret,
      vnpayHost: config.vnpay.url,
      testMode: config.env !== "PROD",
      hashAlgorithm: "SHA512",
      enableLog: config.env !== "PROD",
    });

    this.returnUrl = config.vnpay.returnUrl;
    this.ipnUrl = config.vnpay.ipnUrl;

    logger.info("VNPayService initialized", {
      tmnCode: config.vnpay.tmnCode,
      vnpayHost: config.vnpay.url,
      testMode: config.env !== "PROD",
    });
  }

  /**
   * Create payment URL for VNPay
   * @param {string} orderId - Order ID (vnp_TxnRef)
   * @param {number} vndAmount - Amount in VND
   * @param {string} ipAddress - Client IP address
   * @param {string} orderInfo - Order description
   * @returns {string} Payment URL
   */
  createPaymentUrl(orderId, vndAmount, ipAddress, orderInfo) {
    try {
      const paymentUrl = this.vnpay.buildPaymentUrl({
        vnp_Amount: vndAmount, // Thư viện tự động nhân 100
        vnp_IpAddr: ipAddress,
        vnp_TxnRef: orderId,
        vnp_OrderInfo: orderInfo || `Nap tien ETH - ${orderId}`,
        vnp_OrderType: ProductCode.Other,
        vnp_ReturnUrl: this.returnUrl,
        vnp_Locale: VnpLocale.VN,
      });

      logger.info("VNPay payment URL created", {
        orderId,
        vndAmount,
        ipAddress,
      });

      return paymentUrl;
    } catch (error) {
      logger.error("Failed to create VNPay payment URL", {
        error: error.message,
        orderId,
        vndAmount,
      });
      throw error;
    }
  }

  /**
   * Verify IPN call from VNPay
   * @param {object} query - Query parameters from VNPay IPN
   * @returns {object} Verification result
   */
  verifyIpnCall(query) {
    try {
      const verify = this.vnpay.verifyIpnCall(query);

      logger.debug("VNPay IPN verification", {
        orderId: verify.vnp_TxnRef,
        isVerified: verify.isVerified,
        isSuccess: verify.isSuccess,
        responseCode: verify.vnp_ResponseCode,
      });

      return verify;
    } catch (error) {
      logger.error("Failed to verify VNPay IPN", {
        error: error.message,
        query,
      });
      throw error;
    }
  }

  /**
   * Verify return URL (when user redirects back)
   * @param {object} query - Query parameters from VNPay return URL
   * @returns {object} Verification result
   */
  verifyReturnUrl(query) {
    try {
      const verify = this.vnpay.verifyReturnUrl(query);

      logger.debug("VNPay return URL verification", {
        orderId: verify.vnp_TxnRef,
        isVerified: verify.isVerified,
        isSuccess: verify.isSuccess,
        responseCode: verify.vnp_ResponseCode,
      });

      return verify;
    } catch (error) {
      logger.error("Failed to verify VNPay return URL", {
        error: error.message,
        query,
      });
      throw error;
    }
  }
}

export default VNPayService;
