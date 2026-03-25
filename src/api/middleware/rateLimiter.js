const rateLimit = require('express-rate-limit');
const config = require('../../config');
const { RateLimitError } = require('../../utils/errors');

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.merchant?.id || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        retryAfter: res.getHeader('Retry-After'),
      },
    });
  },
});

const webhookLimiter = rateLimit({
  windowMs: 60000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.params.gateway || req.ip;
  },
});

module.exports = { apiLimiter, webhookLimiter };
