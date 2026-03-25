const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database');
const Transaction = require('../models/Transaction');
const FraudDetectionService = require('./fraudDetectionService');
const { getGateway } = require('../integrations/GatewayFactory');
const {  ValidationError } = require('../utils/errors');
const logger = require('../config/logger');
const { metrics } = require('../monitoring/metrics');

class PaymentService {
  static async createPayment(paymentData, merchant) {
    const startTime = Date.now();

    if (paymentData.idempotency_key) {
      const existing = await Transaction.findByIdempotencyKey(paymentData.idempotency_key);
      if (existing) {
        logger.info('Idempotent request detected', {
          idempotencyKey: paymentData.idempotency_key,
          transactionId: existing.id,
        });
        return existing;
      }
    }

    const fraudResult = FraudDetectionService.analyze(paymentData, merchant);
    if (fraudResult.decision === 'block') {
      metrics.fraudBlockedTotal.inc({ merchant_id: merchant.id });
      throw new ValidationError('Transaction blocked by fraud detection', [{
        rule: 'fraud_score',
        score: fraudResult.score,
        decision: 'blocked',
      }]);
    }

    const gateway = getGateway(paymentData.gateway || 'stripe');

    const transaction = await db.transaction(async (trx) => {
      const txn = await Transaction.create({
        id: uuidv4(),
        merchant_id: merchant.id,
        external_id: 'pending',
        gateway: gateway.name,
        type: paymentData.type || 'payment',
        status: 'processing',
        amount: paymentData.amount,
        currency: paymentData.currency,
        card_last_four: paymentData.card_last_four,
        card_brand: paymentData.card_brand,
        customer_email: paymentData.customer_email,
        customer_ip: paymentData.customer_ip,
        customer_country: paymentData.customer_country,
        fraud_score: fraudResult.score,
        idempotency_key: paymentData.idempotency_key,
        metadata: {
          fraud_rules: fraudResult.rules,
          fraud_decision: fraudResult.decision,
        },
      }, trx);

      return txn;
    });

    try {
      const gatewayResult = await gateway.processPayment({
        amount: paymentData.amount,
        currency: paymentData.currency,
        card: paymentData.card,
        metadata: { transactionId: transaction.id },
      });

      const updated = await Transaction.updateStatus(
        transaction.id,
        gatewayResult.status,
        {
          external_id: gatewayResult.externalId,
          gateway_response: gatewayResult.gatewayResponse,
        }
      );

      const duration = Date.now() - startTime;
      metrics.paymentProcessingDuration.observe({ gateway: gateway.name }, duration / 1000);
      metrics.paymentsTotal.inc({
        gateway: gateway.name,
        status: gatewayResult.status,
        merchant_id: merchant.id,
      });

      logger.info('Payment processed successfully', {
        transactionId: updated.id,
        externalId: gatewayResult.externalId,
        duration,
      });

      return updated;
    } catch (error) {
      await Transaction.updateStatus(transaction.id, 'failed', {
        gateway_response: { error: error.message },
      });

      metrics.paymentsTotal.inc({
        gateway: gateway.name,
        status: 'failed',
        merchant_id: merchant.id,
      });

      throw error;
    }
  }

  static async refundPayment(transactionId, amount, merchant) {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) throw new ValidationError('Transaction not found');
    if (transaction.merchant_id !== merchant.id) throw new ValidationError('Unauthorized');
    if (transaction.status !== 'completed') {
      throw new ValidationError('Only completed transactions can be refunded');
    }
    if (amount > transaction.amount) {
      throw new ValidationError('Refund amount exceeds transaction amount');
    }

    const gateway = getGateway(transaction.gateway);
    const result = await gateway.refund(transaction.external_id, amount);

    const refundTxn = await Transaction.create({
      id: uuidv4(),
      merchant_id: merchant.id,
      external_id: result.refundId,
      gateway: transaction.gateway,
      type: 'refund',
      status: result.status,
      amount: -amount,
      currency: transaction.currency,
      metadata: { original_transaction_id: transactionId },
    });

    await Transaction.updateStatus(transactionId, 'refunded');

    logger.info('Refund processed', {
      originalTransaction: transactionId,
      refundTransaction: refundTxn.id,
      amount,
    });

    return refundTxn;
  }

  static async getTransaction(id, merchantId) {
    const transaction = await Transaction.findById(id);
    if (!transaction || transaction.merchant_id !== merchantId) return null;
    return transaction;
  }

  static async listTransactions(merchantId, filters) {
    return Transaction.listByMerchant(merchantId, filters);
  }

  static async getStats(merchantId, days) {
    return Transaction.getStats(merchantId, days);
  }
}

module.exports = PaymentService;
