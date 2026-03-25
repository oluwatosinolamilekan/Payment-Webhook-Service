const { Router } = require('express');
const WebhookService = require('../../services/webhookService');
const { webhookLimiter } = require('../middleware/rateLimiter');
const { authenticateApiKey } = require('../middleware/auth');
const { validateQuery, paginationSchema } = require('../validators/webhookValidator');
const { getSupportedGateways } = require('../../integrations/GatewayFactory');
const logger = require('../../config/logger');

const router = Router();

/**
 * POST /webhooks/inbound/:gateway
 * Receive webhooks from payment gateways (Stripe, Adyen, etc.)
 * No API key required — validated via gateway-specific signature.
 */
router.post('/inbound/:gateway', webhookLimiter, async (req, res, next) => {
  try {
    const { gateway } = req.params;
    const supported = getSupportedGateways();

    if (!supported.includes(gateway)) {
      return res.status(400).json({
        success: false,
        error: { message: `Unsupported gateway: ${gateway}. Supported: ${supported.join(', ')}` },
      });
    }

    const event = await WebhookService.receiveInbound(gateway, req.body, req.headers);

    if (!event) {
      return res.status(200).json({
        success: true,
        message: 'Webhook received but no matching merchant found',
      });
    }

    // Queue the event for delivery to merchant
    const { webhookDeliveryQueue } = require('../../queues/webhookQueue');
    await webhookDeliveryQueue.add('deliver', { eventId: event.id }, {
      delay: 1000,
      priority: event.event_type.includes('failed') ? 1 : 2,
    });

    res.status(200).json({
      success: true,
      data: {
        eventId: event.id,
        eventType: event.event_type,
        status: event.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /webhooks/events
 * List webhook events for the authenticated merchant.
 */
router.get(
  '/events',
  authenticateApiKey,
  validateQuery(paginationSchema),
  async (req, res, next) => {
    try {
      const result = await WebhookService.getEventHistory(
        req.merchant.id,
        req.validatedQuery
      );

      res.json({
        success: true,
        data: result.items,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /webhooks/events/:id/deliveries
 * Get delivery attempt logs for a specific webhook event.
 */
router.get('/events/:id/deliveries', authenticateApiKey, async (req, res, next) => {
  try {
    const logs = await WebhookService.getDeliveryLogs(req.params.id);

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /webhooks/events/:id/retry
 * Manually retry a failed webhook delivery.
 */
router.post('/events/:id/retry', authenticateApiKey, async (req, res, next) => {
  try {
    const { webhookDeliveryQueue } = require('../../queues/webhookQueue');
    await webhookDeliveryQueue.add('deliver', { eventId: req.params.id }, {
      priority: 1,
    });

    res.json({
      success: true,
      message: 'Webhook delivery retry queued',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
