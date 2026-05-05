import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always load backend/.env (not dependent on the process working directory).
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Validate required environment variables at startup
 * Throws error if any required variable is missing
 */
function validateEnv() {
  const nodeEnv = String(process.env.NODE_ENV || "DEV").toUpperCase();
  const required = [
    'PORT',
    'NODE_ENV',
  ];

  if (nodeEnv === "PROD") {
    required.push("MONGO_PROD_URI");
  } else {
    required.push("MONGO_DEV_URI");
  }

  // Check for Cloudinary variables (either generic or environment-specific)
  const hasCloudinary =
    (process.env.CLOUDINARY_NAME && process.env.CLOUDINARY_KEY && process.env.CLOUDINARY_SECRET) ||
    (process.env.CLOUDINARY_PROD_NAM && process.env.CLOUDINARY_PROD_KEY && process.env.CLOUDINARY_PROD_SECRET) ||
    (process.env.CLOUDINARY_PROD_NAME && process.env.CLOUDINARY_PROD_KEY && process.env.CLOUDINARY_PROD_SECRET);

  if (!hasCloudinary) {
    required.push('CLOUDINARY_NAME', 'CLOUDINARY_KEY', 'CLOUDINARY_SECRET');
  }

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }

  // Validate NODE_ENV value
  const validEnvs = ['DEV', 'PROD', 'TEST', 'Dev', 'Prod', 'Test'];
  if (!validEnvs.includes(nodeEnv) && !validEnvs.map(e => e.toLowerCase()).includes(nodeEnv.toLowerCase())) {
    throw new Error(
      `Invalid NODE_ENV value: ${nodeEnv}\n` +
      `Must be one of: ${validEnvs.join(', ')}`
    );
  }

  console.log('✓ Environment variables validated successfully');
}

/**
 * Get environment-specific configuration
 */
export const config = {
  // Server
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV?.toUpperCase() || 'DEV',
  isDev: process.env.NODE_ENV?.toUpperCase() === 'DEV',
  isProd: process.env.NODE_ENV?.toUpperCase() === 'PROD',
  isTest: process.env.NODE_ENV?.toUpperCase() === 'TEST',

  // Database
  mongoUri: process.env.NODE_ENV?.toUpperCase() === 'PROD'
    ? process.env.MONGO_PROD_URI
    : process.env.MONGO_DEV_URI || process.env.MONGO_PROD_URI,

  // JWT (will be added later)
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },

  // SIWE (will be added later)
  siwe: {
    domain: process.env.SIWE_DOMAIN || 'localhost:4000',
    uri: process.env.SIWE_URI || 'http://localhost:4000',
    chainId: parseInt(process.env.SIWE_CHAIN_ID) || 1
  },

  // Rate Limiting
  rateLimit: {
    windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    maxRequests: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    authMaxRequests: Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5
  },

  // Redis Cloud
  redis: {
    host: process.env.REDIS_HOST,
    port: Number.parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    // Cache TTLs (in seconds)
    ttl: {
      user: Number.parseInt(process.env.REDIS_TTL_USER) || 1800, // 30 minutes
      event: Number.parseInt(process.env.REDIS_TTL_EVENT) || 600, // 10 minutes
      eventStats: Number.parseInt(process.env.REDIS_TTL_EVENT_STATS) || 180, // 3 minutes
      blockchainConfig: Number.parseInt(process.env.REDIS_TTL_BLOCKCHAIN_CONFIG) || 86400, // 24 hours
    }
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Cloudinary - support both generic and environment-specific variables
  cloudinary: {
    name: process.env.CLOUDINARY_NAME ||
          (process.env.NODE_ENV?.toUpperCase() === 'PROD'
            ? process.env.CLOUDINARY_PROD_NAME
            : process.env.CLOUDINARY_PROD_NAM),
    key: process.env.CLOUDINARY_KEY || process.env.CLOUDINARY_PROD_KEY,
    secret: process.env.CLOUDINARY_SECRET || process.env.CLOUDINARY_PROD_SECRET
  },

  // CORS
  allowedOrigins: process.env.ALLOWED_ORIGINS || 'http://localhost:5173',

  // Blockchain
  blockchain: {
    rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
    relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY,
  },

  // VNPay
  vnpay: {
    url: process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn',
    tmnCode: process.env.VNPAY_TMN_CODE,
    hashSecret: process.env.VNPAY_HASH_SECRET,
    returnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:4000/api/deposits/vnpay-return',
    ipnUrl: process.env.VNPAY_IPN_URL,
  },

  // Frontend
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
  },

  // Deposits
  deposits: {
    minVND: Number.parseInt(process.env.MIN_DEPOSIT_VND) || 100000,
    maxVND: Number.parseInt(process.env.MAX_DEPOSIT_VND) || 50000000,
    expiryMinutes: Number.parseInt(process.env.DEPOSIT_ORDER_EXPIRY_MINUTES) || 15,
  },

  // Exchange Rate APIs
  exchangeRate: {
    // CoinMarketCap API key (optional, for fallback)
    coinmarketcapApiKey: process.env.COINMARKETCAP_API_KEY,
    // Cache TTL in milliseconds
    cacheTTL: Number.parseInt(process.env.EXCHANGE_RATE_CACHE_TTL) || 5 * 60 * 1000, // 5 minutes
    // Fallback max age in milliseconds
    fallbackMaxAge: Number.parseInt(process.env.EXCHANGE_RATE_FALLBACK_MAX_AGE) || 24 * 60 * 60 * 1000, // 24 hours
  },

  // Environment alias
  env: process.env.NODE_ENV?.toUpperCase() || 'DEV',
};

// Validate environment on module load
validateEnv();

export default config;
