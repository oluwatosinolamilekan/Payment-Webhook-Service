const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { db } = require('../config/database');
const WebhookEvent = require('../models/WebhookEvent');
const WebhookDeliveryLog = require('../models/WebhookDeliveryLog');
const Transaction = require('../models/Transaction');
const Merchant = require('../models/Merchant');
const { getGateway } = require('../integrations/GatewayFactory');
const { generateSignature } = require('../utils/crypto');
const { ValidationError } = require('../utils/errors');
const logger = require('../config/logger');
const { metrics } = require('../monitoring/metrics');

class WebhookService {
  /**
   * Receive and process an inbound webhook from a payment gateway.
   * Validates signature, normalizes the event, persists it, and queues delivery.
   */
  static async receiveInbound(gatewayName, rawPayload, headers) {
    const gateway = getGateway(gatewayName);

    const normalized = gateway.normalizeEvent(rawPayload);

    logger.info('Inbound webhook received', {
      gateway: gatewayName,
      eventType: normalized.eventType,
      externalId: normalized.externalId,
    });

    const transaction = normalized.externalId
      ? await Transaction.findByExternalId(normalized.externalId, gatewayName)
      : null;

    if (transaction) {
      await this._updateTransactionFromWebhook(transaction, normalized);
    }

    const idempotencyKey = `${gatewayName}:${normalized.rawType}:${normalized.externalId || uuidv4()}`;
    const existingEvent = await WebhookEvent.findByIdempotencyKey(idempotencyKey);
    if (existingEvent) {
      logger.info('Duplicate webhook event ignored', { idempotencyKey });
      return existingEvent;
    }

    const merchantId = transaction?.merchant_id;
    if (!merchantId) {
      logger.warn('Webhook received but no matching merchant found', {
        gateway: gatewayName,
        externalId: normalized.externalId,
      });
      return null;
    }

    const event = await WebhookEvent.create({
      id: uuidv4(),
      transaction_id: transaction?.id,
      merchant_id: merchantId,
      event_type: normalized.eventType,
      source_gateway: gatewayName,
      payload: {
        normalized,
        raw: rawPayload,
      },
      headers: headers || {},
      status: 'received',
      idempotency_key: idempotencyKey,
    });

    metrics.webhooksReceivedTotal.inc({
      gateway: gatewayName,
      event_type: normalized.eventType,
    });

    return event;
  }

  /**
   * Deliver a webhook event to the merchant's configured endpoint.
   * Called by the queue worker.
   */
  static async deliverToMerchant(eventId) {
    const event = await WebhookEvent.findById(eventId);
    if (!event) throw new ValidationError('Webhook event not found');

    const merchant = await Merchant.findById(event.merchant_id);
    if (!merchant || merchant.status !== 'active') {
      logger.warn('Merchant inactive, skipping webhook delivery', {
        eventId,
        merchantId: event.merchant_id,
      });
      await WebhookEvent.updateStatus(eventId, 'failed');
      return;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateSignature(event.payload, merchant.webhook_secret, timestamp);

    const deliveryPayload = {
      id: event.id,
      type: event.event_type,
      created: timestamp,
      data: event.payload.normalized,
    };

    const startTime = Date.now();
    let attempt;

    try {
      await WebhookEvent.incrementDeliveryAttempts(eventId);

      const response = await axios.post(merchant.webhook_url, deliveryPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Id': event.id,
          'X-Webhook-Timestamp': timestamp.toString(),
          'X-Webhook-Signature': `t=${timestamp},v1=${signature}`,
          'User-Agent': 'Pay4X-Webhook/1.0',
        },
        timeout: 30000,
        validateStatus: (status) => status < 500,
      });

      const duration = Date.now() - startTime;

      attempt = await WebhookDeliveryLog.create({
        id: uuidv4(),
        webhook_event_id: eventId,
        attempt_number: event.delivery_attempts + 1,
        url: merchant.webhook_url,
        response_status: response.status,
        response_body: typeof response.data === 'string'
          ? response.data.slice(0, 1000)
          : JSON.stringify(response.data).slice(0, 1000),
        request_headers: deliveryPayload,
        duration_ms: duration,
      });

      if (response.status >= 200 && response.status < 300) {
        await WebhookEvent.updateStatus(eventId, 'delivered', {
          delivered_at: db.fn.now(),
        });
        metrics.webhooksDeliveredTotal.inc({ status: 'success' });
        logger.info('Webhook delivered successfully', {
          eventId,
          merchantId: merchant.id,
          status: response.status,
          duration,
        });
      } else {
        throw new Error(`Non-success response: ${response.status}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      if (!attempt) {
        await WebhookDeliveryLog.create({
          id: uuidv4(),
          webhook_event_id: eventId,
          attempt_number: event.delivery_attempts + 1,
          url: merchant.webhook_url,
          response_status: error.response?.status,
          error_message: error.message,
          duration_ms: duration,
        });
      }

      const updatedEvent = await WebhookEvent.findById(eventId);
      if (updatedEvent.delivery_attempts >= 5) {
        await WebhookEvent.moveToDeadLetter(eventId);
        metrics.webhooksDeliveredTotal.inc({ status: 'dead_letter' });
        logger.error('Webhook moved to dead letter queue', { eventId });
      } else {
        await WebhookEvent.updateStatus(eventId, 'failed');
        metrics.webhooksDeliveredTotal.inc({ status: 'failed' });
      }

      throw error;
    }
  }

  static async _updateTransactionFromWebhook(transaction, normalized) {
    const statusMap = {
      'payment.completed': 'completed',
      'payment.failed': 'failed',
      'payment.refunded': 'refunded',
      'payment.disputed': 'disputed',
      'payment.cancelled': 'cancelled',
    };

    const newStatus = statusMap[normalized.eventType];
    if (newStatus && transaction.status !== newStatus) {
      await Transaction.updateStatus(transaction.id, newStatus);
      logger.info('Transaction status updated from webhook', {
        transactionId: transaction.id,
        oldStatus: transaction.status,
        newStatus,
      });
    }
  }

  static async retryFailed() {
    const failedEvents = await WebhookEvent.getFailedEvents();
    logger.info(`Retrying ${failedEvents.length} failed webhook events`);
    return failedEvents;
  }

  static async getEventHistory(merchantId, filters) {
    return WebhookEvent.listByMerchant(merchantId, filters);
  }

  static async getDeliveryLogs(eventId) {
    return WebhookDeliveryLog.findByEventId(eventId);
  }
}

module.exports = WebhookService;
