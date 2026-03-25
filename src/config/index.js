require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiVersion: process.env.API_VERSION || 'v1',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'payment_webhooks',
    user: process.env.DB_USER || 'pay4x',
    password: process.env.DB_PASSWORD || '',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
      max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
    },
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
  },

  webhook: {
    signingSecret: process.env.WEBHOOK_SIGNING_SECRET || 'whsec_default',
    toleranceSeconds: parseInt(process.env.WEBHOOK_TOLERANCE_SECONDS, 10) || 300,
    retryAttempts: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS, 10) || 5,
    retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY, 10) || 60000,
  },

  auth: {
    apiKeyHeader: process.env.API_KEY_HEADER || 'X-API-Key',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  },

  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY, 10) || 10,
  },

  gateways: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
    adyen: {
      apiKey: process.env.ADYEN_API_KEY,
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
    },
  },

  monitoring: {
    metricsEnabled: process.env.METRICS_ENABLED === 'true',
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },
};

module.exports = config;
