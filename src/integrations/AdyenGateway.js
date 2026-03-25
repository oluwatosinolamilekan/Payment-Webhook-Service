const crypto = require('crypto');
const BaseGateway = require('./BaseGateway');
const { GatewayError } = require('../utils/errors');

const EVENT_MAP = {
  AUTHORISATION: 'payment.completed',
  CANCELLATION: 'payment.cancelled',
  REFUND: 'payment.refunded',
  CAPTURE: 'payment.captured',
  CHARGEBACK: 'payment.disputed',
  PAYOUT_THIRDPARTY: 'payout.completed',
};

class AdyenGateway extends BaseGateway {
  constructor(config) {
    super('adyen', config);
  }

  async processPayment(paymentData) {
    this._log('info', 'Processing payment via Adyen', {
      amount: paymentData.amount,
      currency: paymentData.currency,
    });

    try {
      const response = {
        pspReference: crypto.randomBytes(8).toString('hex').toUpperCase(),
        resultCode: 'Authorised',
        amount: { value: paymentData.amount * 100, currency: paymentData.currency },
      };

      return {
        success: true,
        externalId: response.pspReference,
        status: 'completed',
        gatewayResponse: response,
      };
    } catch (error) {
      throw new GatewayError('adyen', error.message);
    }
  }

  async refund(externalId, amount) {
    this._log('info', 'Processing Adyen refund', { externalId, amount });

    return {
      success: true,
      refundId: crypto.randomBytes(8).toString('hex').toUpperCase(),
      status: 'refunded',
      amount,
    };
  }

  async getTransactionStatus(externalId) {
    return { externalId, status: 'completed' };
  }

  verifyWebhookSignature(payload, hmacSignature) {
    const hmacKey = this.config.hmacKey;
    if (!hmacKey) {
      throw new GatewayError('adyen', 'HMAC key not configured');
    }

    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const computed = crypto
      .createHmac('sha256', Buffer.from(hmacKey, 'hex'))
      .update(payloadStr)
      .digest('base64');

    return computed === hmacSignature;
  }

  normalizeEvent(rawEvent) {
    const item = rawEvent.notificationItems?.[0]?.NotificationRequestItem || rawEvent;
    const eventCode = item.eventCode || 'UNKNOWN';
    const eventType = EVENT_MAP[eventCode] || `unknown.${eventCode}`;

    return {
      eventType,
      externalId: item.pspReference,
      amount: item.amount ? item.amount.value / 100 : null,
      currency: item.amount?.currency,
      status: item.success === 'true' ? 'completed' : 'failed',
      rawType: eventCode,
      metadata: item.additionalData || {},
    };
  }
}

module.exports = AdyenGateway;
