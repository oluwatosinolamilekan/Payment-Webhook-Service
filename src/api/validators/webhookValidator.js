const Joi = require('joi');
const { ValidationError } = require('../../utils/errors');

const paymentSchema = Joi.object({
  amount: Joi.number().positive().precision(2).required(),
  currency: Joi.string().length(3).uppercase().required(),
  gateway: Joi.string().valid('stripe', 'adyen').default('stripe'),
  type: Joi.string().valid('payment', 'payout').default('payment'),
  card_last_four: Joi.string().length(4).pattern(/^\d+$/),
  card_brand: Joi.string().valid('visa', 'mastercard', 'amex', 'discover'),
  customer_email: Joi.string().email(),
  customer_ip: Joi.string().ip(),
  customer_country: Joi.string().length(2).uppercase(),
  idempotency_key: Joi.string().max(255),
  metadata: Joi.object(),
});

const refundSchema = Joi.object({
  amount: Joi.number().positive().precision(2).required(),
  reason: Joi.string().max(500),
});

const merchantSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  webhook_url: Joi.string().uri().required(),
  risk_level: Joi.string().valid('low', 'medium', 'high').default('low'),
  metadata: Joi.object(),
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string(),
  type: Joi.string(),
  event_type: Joi.string(),
});

function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      return next(new ValidationError('Validation failed', details));
    }

    req.validatedBody = value;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      return next(new ValidationError('Query validation failed', details));
    }

    req.validatedQuery = value;
    next();
  };
}

module.exports = {
  validate,
  validateQuery,
  paymentSchema,
  refundSchema,
  merchantSchema,
  paginationSchema,
};
