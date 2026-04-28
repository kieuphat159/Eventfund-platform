import axios from "axios";
import { ethers } from "ethers";
import ExchangeRateCache from "../../models/ExchangeRateCache.model.js";
import logger from "../../config/logger.js";
import config from "../../config/env.js";

class ExchangeRateService {
  constructor() {
    // API endpoints
    this.coingeckoUrl = "https://api.coingecko.com/api/v3/simple/price";
    this.cryptocompareUrl = "https://min-api.cryptocompare.com/data/price";
    this.coinmarketcapUrl = "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest";

    // Configuration
    this.cacheTTL = config.exchangeRate.cacheTTL;
    this.fallbackMaxAge = config.exchangeRate.fallbackMaxAge;
    this.coinmarketcapApiKey = config.exchangeRate.coinmarketcapApiKey;

    // Fixed USD to VND rate (approximate, updated periodically in code)
    // Source: https://www.xe.com/currencyconverter/convert/?From=USD&To=VND
    // Last updated: 2026-04-28
    this.usdToVndRate = 25000;

    // Retry configuration
    this.retryAttempts = 2;
    this.retryDelay = 1000; // 1 second initial delay
  }

  /**
   * Sleep helper for retry logic
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch ETH to VND directly from CoinGecko
   * @returns {Promise<{rate: number, source: string}>}
   */
  async fetchFromCoinGecko() {
    try {
      logger.info("Fetching ETH→VND from CoinGecko");

      const response = await axios.get(this.coingeckoUrl, {
        params: {
          ids: "ethereum",
          vs_currencies: "vnd",
        },
        timeout: 5000,
      });

      const rate = response.data?.ethereum?.vnd;

      if (!rate || rate <= 0) {
        throw new Error("Invalid rate from CoinGecko");
      }

      logger.info("CoinGecko success", { rate });
      return { rate, source: "coingecko" };
    } catch (error) {
      logger.warn("CoinGecko failed", {
        error: error.message,
        status: error.response?.status,
      });
      throw error;
    }
  }

  /**
   * Fetch ETH to USD from CryptoCompare, then convert to VND
   * @returns {Promise<{rate: number, source: string}>}
   */
  async fetchFromCryptoCompare() {
    try {
      logger.info("Fetching ETH→USD from CryptoCompare");

      const response = await axios.get(this.cryptocompareUrl, {
        params: {
          fsym: "ETH",
          tsyms: "USD",
        },
        timeout: 5000,
      });

      const ethToUsd = response.data?.USD;

      if (!ethToUsd || ethToUsd <= 0) {
        throw new Error("Invalid rate from CryptoCompare");
      }

      // Convert ETH→USD to ETH→VND
      const rate = ethToUsd * this.usdToVndRate;

      logger.info("CryptoCompare success", {
        ethToUsd,
        usdToVnd: this.usdToVndRate,
        finalRate: rate,
      });

      return { rate, source: "cryptocompare" };
    } catch (error) {
      logger.warn("CryptoCompare failed", {
        error: error.message,
        status: error.response?.status,
      });
      throw error;
    }
  }

  /**
   * Fetch ETH to USD from CoinMarketCap, then convert to VND
   * Requires API key
   * @returns {Promise<{rate: number, source: string}>}
   */
  async fetchFromCoinMarketCap() {
    if (!this.coinmarketcapApiKey) {
      throw new Error("CoinMarketCap API key not configured");
    }

    try {
      logger.info("Fetching ETH→USD from CoinMarketCap");

      const response = await axios.get(this.coinmarketcapUrl, {
        params: {
          symbol: "ETH",
          convert: "USD",
        },
        headers: {
          "X-CMC_PRO_API_KEY": this.coinmarketcapApiKey,
        },
        timeout: 5000,
      });

      const ethToUsd = response.data?.data?.ETH?.quote?.USD?.price;

      if (!ethToUsd || ethToUsd <= 0) {
        throw new Error("Invalid rate from CoinMarketCap");
      }

      // Convert ETH→USD to ETH→VND
      const rate = ethToUsd * this.usdToVndRate;

      logger.info("CoinMarketCap success", {
        ethToUsd,
        usdToVnd: this.usdToVndRate,
        finalRate: rate,
      });

      return { rate, source: "coinmarketcap" };
    } catch (error) {
      logger.warn("CoinMarketCap failed", {
        error: error.message,
        status: error.response?.status,
      });
      throw error;
    }
  }

  /**
   * Fetch exchange rate with multi-source fallback
   * Priority: CoinMarketCap → CoinGecko → CryptoCompare
   * @returns {Promise<{rate: number, source: string}>}
   */
  async fetchExchangeRate() {
    const sources = [
      { name: "CoinMarketCap", fn: () => this.fetchFromCoinMarketCap() },
      { name: "CoinGecko", fn: () => this.fetchFromCoinGecko() },
      { name: "CryptoCompare", fn: () => this.fetchFromCryptoCompare() },
    ];

    let lastError;

    for (const source of sources) {
      try {
        console.log(`[ExchangeRate] 🔄 Trying ${source.name}...`);
        const result = await source.fn();
        logger.info(`Exchange rate fetched successfully from ${source.name}`, {
          rate: result.rate,
          source: result.source,
        });
        return result;
      } catch (error) {
        lastError = error;
        console.log(`[ExchangeRate] ❌ ${source.name} failed: ${error.message}`);
        logger.warn(`${source.name} failed, trying next source`, {
          error: error.message,
        });
        continue;
      }
    }

    // All sources failed
    throw new Error(
      `All exchange rate sources failed. Last error: ${lastError?.message}`
    );
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
        logger.info("Exchange rate from cache", {
          rate: cached.vndRate,
          source: cached.source,
        });
        console.log(`[ExchangeRate] ✅ Using CACHE | source: ${cached.source} | rate: ${cached.vndRate} VND/ETH`);
        return cached.vndRate;
      }

      // 2. Fetch from APIs with multi-source fallback
      const { rate, source } = await this.fetchExchangeRate();

      console.log(`[ExchangeRate] ✅ Fetched from API | source: ${source} | rate: ${rate} VND/ETH`);

      // 3. Save to cache
      await ExchangeRateCache.create({
        currency: "ETH",
        vndRate: rate,
        source,
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + this.cacheTTL),
      });

      logger.info("Exchange rate cached", { rate, source });

      return rate;
    } catch (error) {
      logger.error("Failed to fetch exchange rate from all sources", {
        error: error.message,
      });

      // Fallback: Get most recent cache (even if expired)
      const fallback = await ExchangeRateCache.findOne({ currency: "ETH" })
        .sort({ fetchedAt: -1 })
        .limit(1);

      if (fallback) {
        const age = Date.now() - fallback.fetchedAt.getTime();

        // Only use fallback if it's not too old
        if (age <= this.fallbackMaxAge) {
          console.log(`[ExchangeRate] ⚠️  Using FALLBACK cache | source: ${fallback.source} | rate: ${fallback.vndRate} VND/ETH | age: ${Math.round(age / 60000)} minutes`);
          logger.warn("Using fallback exchange rate from cache", {
            rate: fallback.vndRate,
            source: fallback.source,
            ageMinutes: Math.round(age / 60000),
          });
          return fallback.vndRate;
        } else {
          logger.error("Fallback cache too old", {
            ageHours: Math.round(age / 3600000),
            maxAgeHours: this.fallbackMaxAge / 3600000,
          });
        }
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
