const { GatewayError } = require('../utils/errors');
const logger = require('../config/logger');

class BaseGateway {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
  }

  async processPayment(_paymentData) {
    throw new GatewayError(this.name, 'processPayment not implemented');
  }

  async refund(_transactionId, _amount) {
    throw new GatewayError(this.name, 'refund not implemented');
  }

  async getTransactionStatus(_externalId) {
    throw new GatewayError(this.name, 'getTransactionStatus not implemented');
  }

  verifyWebhookSignature(_payload, _signature) {
    throw new GatewayError(this.name, 'verifyWebhookSignature not implemented');
  }

  normalizeEvent(_rawEvent) {
    throw new GatewayError(this.name, 'normalizeEvent not implemented');
  }

  _log(level, message, meta = {}) {
    logger[level](`[${this.name}] ${message}`, { gateway: this.name, ...meta });
  }
}

module.exports = BaseGateway;
