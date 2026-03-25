const StripeGateway = require('../../../src/integrations/StripeGateway');

jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('StripeGateway', () => {
  let gateway;

  beforeEach(() => {
    gateway = new StripeGateway({ webhookSecret: 'whsec_test' });
  });

  describe('processPayment', () => {
    it('should process a payment and return expected structure', async () => {
      const result = await gateway.processPayment({
        amount: 100,
        currency: 'USD',
      });

      expect(result.success).toBe(true);
      expect(result.externalId).toMatch(/^pi_/);
      expect(result.status).toBe('completed');
      expect(result.gatewayResponse).toBeDefined();
    });
  });

  describe('refund', () => {
    it('should process a refund', async () => {
      const result = await gateway.refund('pi_test123', 50);

      expect(result.success).toBe(true);
      expect(result.refundId).toMatch(/^re_/);
      expect(result.status).toBe('refunded');
      expect(result.amount).toBe(50);
    });
  });

  describe('normalizeEvent', () => {
    it('should normalize payment_intent.succeeded event', () => {
      const rawEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_abc123',
            amount: 5000,
            currency: 'usd',
            metadata: { orderId: '123' },
          },
        },
      };

      const result = gateway.normalizeEvent(rawEvent);

      expect(result.eventType).toBe('payment.completed');
      expect(result.externalId).toBe('pi_abc123');
      expect(result.amount).toBe(50); // cents to dollars
      expect(result.currency).toBe('USD');
      expect(result.status).toBe('completed');
    });

    it('should normalize payment_intent.payment_failed event', () => {
      const rawEvent = {
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_failed123',
            amount: 2000,
            currency: 'eur',
          },
        },
      };

      const result = gateway.normalizeEvent(rawEvent);

      expect(result.eventType).toBe('payment.failed');
      expect(result.status).toBe('failed');
    });

    it('should normalize charge.refunded event', () => {
      const rawEvent = {
        type: 'charge.refunded',
        data: {
          object: {
            payment_intent: 'pi_original123',
            amount: 3000,
            currency: 'gbp',
          },
        },
      };

      const result = gateway.normalizeEvent(rawEvent);

      expect(result.eventType).toBe('payment.refunded');
      expect(result.externalId).toBe('pi_original123');
    });

    it('should handle unknown event types gracefully', () => {
      const rawEvent = {
        type: 'unknown.event',
        data: { object: {} },
      };

      const result = gateway.normalizeEvent(rawEvent);

      expect(result.eventType).toBe('unknown.unknown.event');
      expect(result.status).toBe('unknown');
    });
  });
});
