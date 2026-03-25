const { Router } = require('express');
const PaymentService = require('../../services/paymentService');
const { authenticateApiKey, requireMerchantStatus } = require('../middleware/auth');
const { idempotencyCheck } = require('../middleware/idempotency');
const {
  validate,
  validateQuery,
  paymentSchema,
  refundSchema,
  paginationSchema,
} = require('../validators/webhookValidator');

const router = Router();

router.use(authenticateApiKey);

/**
 * POST /payments
 * Create a new payment transaction.
 */
router.post(
  '/',
  requireMerchantStatus('active'),
  idempotencyCheck,
  validate(paymentSchema),
  async (req, res, next) => {
    try {
      const transaction = await PaymentService.createPayment(
        req.validatedBody,
        req.merchant
      );

      res.status(201).json({
        success: true,
        data: {
          id: transaction.id,
          external_id: transaction.external_id,
          status: transaction.status,
          amount: transaction.amount,
          currency: transaction.currency,
          gateway: transaction.gateway,
          fraud_score: transaction.fraud_score,
          created_at: transaction.created_at,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /payments
 * List transactions for the authenticated merchant.
 */
router.get('/', validateQuery(paginationSchema), async (req, res, next) => {
  try {
    const result = await PaymentService.listTransactions(
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
});

/**
 * GET /payments/stats
 * Get payment statistics for the authenticated merchant.
 */
router.get('/stats', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const stats = await PaymentService.getStats(req.merchant.id, days);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /payments/:id
 * Get a specific transaction by ID.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const transaction = await PaymentService.getTransaction(
      req.params.id,
      req.merchant.id
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transaction not found' },
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /payments/:id/refund
 * Initiate a refund for a completed transaction.
 */
router.post(
  '/:id/refund',
  requireMerchantStatus('active'),
  validate(refundSchema),
  async (req, res, next) => {
    try {
      const refund = await PaymentService.refundPayment(
        req.params.id,
        req.validatedBody.amount,
        req.merchant
      );

      res.status(201).json({
        success: true,
        data: refund,
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
