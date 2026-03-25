const logger = require('../config/logger');

/**
 * Notification service for internal alerts.
 * In production, this would integrate with Slack, PagerDuty, email, etc.
 */
class NotificationService {
  static async sendAlert(type, data) {
    logger.warn(`ALERT [${type}]`, data);

    switch (type) {
      case 'fraud_blocked':
        await this._handleFraudAlert(data);
        break;
      case 'webhook_dead_letter':
        await this._handleDeadLetterAlert(data);
        break;
      case 'gateway_error':
        await this._handleGatewayAlert(data);
        break;
      case 'high_failure_rate':
        await this._handleFailureRateAlert(data);
        break;
      default:
        logger.info(`Unhandled alert type: ${type}`, data);
    }
  }

  static async _handleFraudAlert(data) {
    logger.error('FRAUD ALERT: Transaction blocked', {
      merchantId: data.merchantId,
      amount: data.amount,
      fraudScore: data.fraudScore,
      rules: data.rules,
    });
  }

  static async _handleDeadLetterAlert(data) {
    logger.error('DEAD LETTER ALERT: Webhook delivery permanently failed', {
      eventId: data.eventId,
      merchantId: data.merchantId,
      attempts: data.attempts,
    });
  }

  static async _handleGatewayAlert(data) {
    logger.error('GATEWAY ALERT: Payment gateway error', {
      gateway: data.gateway,
      error: data.error,
    });
  }

  static async _handleFailureRateAlert(data) {
    logger.error('FAILURE RATE ALERT: High failure rate detected', {
      gateway: data.gateway,
      failureRate: data.failureRate,
      window: data.window,
    });
  }
}

module.exports = NotificationService;
