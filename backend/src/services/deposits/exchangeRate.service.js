import axios from "axios";
import { ethers } from "ethers";
import ExchangeRateCache from "../../models/ExchangeRateCache.model.js";
import logger from "../../config/logger.js";

class ExchangeRateService {
  constructor() {
    this.apiUrl = "https://api.coingecko.com/api/v3/simple/price";
    this.cacheTTL = 60000; // 1 minute
  }

  /**
   * Get ETH to VND exchange rate
   * @returns {Promise<number>} Exchange rate (VND per ETH)
   */
  async getETHtoVND() {
    try {
      // 1. Check cache
      const cached = await ExchangeRateCache.findOne({
        currency: "ETH",
        expiresAt: { $gt: new Date() },
      }).sort({ fetchedAt: -1 });

      if (cached) {
        logger.debug("Exchange rate from cache", { rate: cached.vndRate });
        return cached.vndRate;
      }

      // 2. Fetch from CoinGecko
      logger.info("Fetching exchange rate from CoinGecko");

      const response = await axios.get(this.apiUrl, {
        params: {
          ids: "ethereum",
          vs_currencies: "vnd",
        },
        timeout: 5000,
      });

      const rate = response.data?.ethereum?.vnd;

      if (!rate || rate <= 0) {
        throw new Error("Invalid exchange rate from CoinGecko");
      }

      // 3. Save to cache
      await ExchangeRateCache.create({
        currency: "ETH",
        vndRate: rate,
        source: "coingecko",
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + this.cacheTTL),
      });

      logger.info("Exchange rate fetched from CoinGecko", { rate });

      return rate;
    } catch (error) {
      logger.error("Failed to fetch exchange rate", {
        error: error.message,
        stack: error.stack,
      });

      // Fallback: Lấy rate gần nhất từ cache (kể cả expired)
      const fallback = await ExchangeRateCache.findOne({ currency: "ETH" })
        .sort({ fetchedAt: -1 })
        .limit(1);

      if (fallback) {
        logger.warn("Using fallback exchange rate", {
          rate: fallback.vndRate,
          age: Date.now() - fallback.fetchedAt.getTime(),
        });
        return fallback.vndRate;
      }

      throw new Error("Cannot fetch exchange rate and no fallback available");
    }
  }

  /**
   * Calculate ETH amount from VND amount
   * @param {number} vndAmount - Amount in VND
   * @param {number} exchangeRate - VND per ETH
   * @returns {string} Amount in Wei (string)
   */
  calculateETHAmount(vndAmount, exchangeRate) {
    if (!vndAmount || !exchangeRate || exchangeRate <= 0) {
      throw new Error("Invalid vndAmount or exchangeRate");
    }

    const ethAmount = vndAmount / exchangeRate;
    const weiAmount = ethers.parseEther(ethAmount.toFixed(18));

    return weiAmount.toString();
  }

  /**
   * Format Wei to ETH (human-readable)
   * @param {string} weiAmount - Amount in Wei
   * @returns {string} Amount in ETH
   */
  formatWeiToETH(weiAmount) {
    return ethers.formatEther(weiAmount);
  }
}

export default ExchangeRateService;
