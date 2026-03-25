const { Router } = require('express');
const crypto = require('crypto');
const Merchant = require('../../models/Merchant');
const { validate, merchantSchema } = require('../validators/webhookValidator');
const { authenticateApiKey } = require('../middleware/auth');
const { hashApiKey } = require('../../utils/crypto');
const { v4: uuidv4 } = require('uuid');

const router = Router();

/**
 * POST /merchants
 * Register a new merchant. Returns the API key (shown only once).
 */
router.post('/', validate(merchantSchema), async (req, res, next) => {
  try {
    const apiKey = `pk_${crypto.randomBytes(24).toString('hex')}`;
    const webhookSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const merchant = await Merchant.create({
      id: uuidv4(),
      name: req.validatedBody.name,
      api_key_hash: hashApiKey(apiKey),
      webhook_url: req.validatedBody.webhook_url,
      webhook_secret: webhookSecret,
      risk_level: req.validatedBody.risk_level,
      metadata: req.validatedBody.metadata || {},
    });

    res.status(201).json({
      success: true,
      data: {
        id: merchant.id,
        name: merchant.name,
        api_key: apiKey, // Only returned on creation
        webhook_secret: webhookSecret,
        webhook_url: merchant.webhook_url,
        risk_level: merchant.risk_level,
        status: merchant.status,
        created_at: merchant.created_at,
      },
      warning: 'Store the api_key and webhook_secret securely. They will not be shown again.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /merchants/me
 * Get authenticated merchant profile.
 */
router.get('/me', authenticateApiKey, async (req, res) => {
  const { api_key_hash, webhook_secret, ...merchantData } = req.merchant;

  res.json({
    success: true,
    data: merchantData,
  });
});

/**
 * PATCH /merchants/me
 * Update merchant settings.
 */
router.patch('/me', authenticateApiKey, async (req, res, next) => {
  try {
    const allowedFields = ['name', 'webhook_url', 'metadata'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const merchant = await Merchant.update(req.merchant.id, updates);
    const { api_key_hash, webhook_secret, ...merchantData } = merchant;

    res.json({
      success: true,
      data: merchantData,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
