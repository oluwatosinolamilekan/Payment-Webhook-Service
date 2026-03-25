const crypto = require('crypto');
const BaseGateway = require('./BaseGateway');
const { GatewayError } = require('../utils/errors');

const EVENT_MAP = {
  'payment_intent.succeeded': 'payment.completed',
  'payment_intent.payment_failed': 'payment.failed',
  'charge.refunded': 'payment.refunded',
  'charge.dispute.created': 'payment.disputed',
  'charge.dispute.closed': 'payment.dispute_resolved',
  'payout.paid': 'payout.completed',
  'payout.failed': 'payout.failed',
};

class StripeGateway extends BaseGateway {
  constructor(config) {
    super('stripe', config);
  }

  async processPayment(paymentData) {
    this._log('info', 'Processing payment', {
      amount: paymentData.amount,
      currency: paymentData.currency,
    });

    try {
      // In production, this would call Stripe's API via axios/stripe SDK
      const response = {
        id: `pi_${crypto.randomBytes(12).toString('hex')}`,
        status: 'succeeded',
        amount: paymentData.amount,
        currency: paymentData.currency,
        created: Math.floor(Date.now() / 1000),
      };

      this._log('info', 'Payment processed', { externalId: response.id });
      return {
        success: true,
        externalId: response.id,
        status: 'completed',
        gatewayResponse: response,
      };
    } catch (error) {
      this._log('error', 'Payment failed', { error: error.message });
      throw new GatewayError('stripe', error.message);
    }
  }

  async refund(externalId, amount) {
    this._log('info', 'Processing refund', { externalId, amount });

    return {
      success: true,
      refundId: `re_${crypto.randomBytes(12).toString('hex')}`,
      status: 'refunded',
      amount,
    };
  }

  async getTransactionStatus(externalId) {
    this._log('info', 'Fetching transaction status', { externalId });
    return { externalId, status: 'completed' };
  }

  verifyWebhookSignature(payload, signatureHeader) {
    const secret = this.config.webhookSecret;
    if (!secret) {
      throw new GatewayError('stripe', 'Webhook secret not configured');
    }

    const parts = signatureHeader.split(',');
    const timestamp = parts.find((p) => p.startsWith('t='))?.split('=')[1];
    const signature = parts.find((p) => p.startsWith('v1='))?.split('=')[1];

    if (!timestamp || !signature) {
      return false;
    }

    const signedPayload = `${timestamp}.${typeof payload === 'string' ? payload : JSON.stringify(payload)}`;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  }

  normalizeEvent(rawEvent) {
    const eventType = EVENT_MAP[rawEvent.type] || `unknown.${rawEvent.type}`;
    const data = rawEvent.data?.object || {};

    return {
      eventType,
      externalId: data.id || data.payment_intent,
      amount: data.amount ? data.amount / 100 : null,
      currency: data.currency?.toUpperCase(),
      status: this._mapStatus(rawEvent.type),
      rawType: rawEvent.type,
      metadata: data.metadata || {},
    };
  }

  _mapStatus(stripeType) {
    const statusMap = {
      'payment_intent.succeeded': 'completed',
      'payment_intent.payment_failed': 'failed',
      'charge.refunded': 'refunded',
      'charge.dispute.created': 'disputed',
    };
    return statusMap[stripeType] || 'unknown';
  }
}

module.exports = StripeGateway;
