const {
  validate,
  paymentSchema,
  refundSchema,
} = require('../../../src/api/validators/webhookValidator');

describe('Validators', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {} };
    res = {};
    next = jest.fn();
  });

  describe('Payment validation', () => {
    const validPayment = {
      amount: 99.99,
      currency: 'USD',
      gateway: 'stripe',
      customer_email: 'user@example.com',
      customer_ip: '192.168.1.1',
    };

    it('should pass valid payment data', () => {
      req.body = validPayment;
      validate(paymentSchema)(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.validatedBody).toBeDefined();
      expect(req.validatedBody.amount).toBe(99.99);
    });

    it('should reject missing amount', () => {
      req.body = { currency: 'USD' };
      validate(paymentSchema)(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
    });

    it('should reject negative amount', () => {
      req.body = { ...validPayment, amount: -10 };
      validate(paymentSchema)(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
    });

    it('should reject invalid currency format', () => {
      req.body = { ...validPayment, currency: 'USDX' };
      validate(paymentSchema)(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
    });

    it('should reject unsupported gateway', () => {
      req.body = { ...validPayment, gateway: 'paypal' };
      validate(paymentSchema)(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
    });

    it('should reject invalid email format', () => {
      req.body = { ...validPayment, customer_email: 'not-an-email' };
      validate(paymentSchema)(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
    });

    it('should strip unknown fields', () => {
      req.body = { ...validPayment, hackField: 'evil' };
      validate(paymentSchema)(req, res, next);

      expect(req.validatedBody.hackField).toBeUndefined();
    });

    it('should set default gateway to stripe', () => {
      req.body = { amount: 50, currency: 'EUR' };
      validate(paymentSchema)(req, res, next);

      expect(req.validatedBody.gateway).toBe('stripe');
    });
  });

  describe('Refund validation', () => {
    it('should pass valid refund data', () => {
      req.body = { amount: 50, reason: 'Customer request' };
      validate(refundSchema)(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should reject refund without amount', () => {
      req.body = { reason: 'test' };
      validate(refundSchema)(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
    });
  });
});
