const WebhookService = require('../../../src/services/webhookService');

// Mock all dependencies
jest.mock('../../../src/config/database', () => ({
  db: { fn: { now: jest.fn(() => new Date()) } },
}));

jest.mock('../../../src/models/WebhookEvent', () => ({
  findById: jest.fn(),
  findByIdempotencyKey: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
  incrementDeliveryAttempts: jest.fn(),
  moveToDeadLetter: jest.fn(),
  getFailedEvents: jest.fn(),
  listByMerchant: jest.fn(),
}));

jest.mock('../../../src/models/WebhookDeliveryLog', () => ({
  create: jest.fn(),
  findByEventId: jest.fn(),
}));

jest.mock('../../../src/models/Transaction', () => ({
  findByExternalId: jest.fn(),
  updateStatus: jest.fn(),
}));

jest.mock('../../../src/models/Merchant', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../src/integrations/GatewayFactory', () => ({
  getGateway: jest.fn(),
}));

jest.mock('../../../src/monitoring/metrics', () => ({
  metrics: {
    webhooksReceivedTotal: { inc: jest.fn() },
    webhooksDeliveredTotal: { inc: jest.fn() },
  },
}));

const WebhookEvent = require('../../../src/models/WebhookEvent');
const Transaction = require('../../../src/models/Transaction');
const { getGateway } = require('../../../src/integrations/GatewayFactory');

describe('WebhookService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('receiveInbound', () => {
    const mockGateway = {
      normalizeEvent: jest.fn().mockReturnValue({
        eventType: 'payment.completed',
        externalId: 'pi_test123',
        amount: 100,
        currency: 'USD',
        status: 'completed',
        rawType: 'payment_intent.succeeded',
        metadata: {},
      }),
    };

    beforeEach(() => {
      getGateway.mockReturnValue(mockGateway);
    });

    it('should process a valid inbound webhook', async () => {
      const mockTransaction = {
        id: 'txn-1',
        merchant_id: 'merchant-1',
        status: 'processing',
      };

      Transaction.findByExternalId.mockResolvedValue(mockTransaction);
      WebhookEvent.findByIdempotencyKey.mockResolvedValue(null);
      WebhookEvent.create.mockResolvedValue({
        id: 'evt-1',
        event_type: 'payment.completed',
        status: 'received',
      });

      const result = await WebhookService.receiveInbound(
        'stripe',
        { type: 'payment_intent.succeeded', data: { object: { id: 'pi_test123' } } },
        {}
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('evt-1');
      expect(WebhookEvent.create).toHaveBeenCalled();
      expect(Transaction.updateStatus).toHaveBeenCalledWith('txn-1', 'completed');
    });

    it('should deduplicate webhook events by idempotency key', async () => {
      const existingEvent = { id: 'evt-existing', status: 'delivered' };

      Transaction.findByExternalId.mockResolvedValue({
        id: 'txn-1',
        merchant_id: 'merchant-1',
        status: 'completed',
      });
      WebhookEvent.findByIdempotencyKey.mockResolvedValue(existingEvent);

      const result = await WebhookService.receiveInbound('stripe', {}, {});

      expect(result).toEqual(existingEvent);
      expect(WebhookEvent.create).not.toHaveBeenCalled();
    });

    it('should return null when no matching merchant found', async () => {
      Transaction.findByExternalId.mockResolvedValue(null);
      WebhookEvent.findByIdempotencyKey.mockResolvedValue(null);

      const result = await WebhookService.receiveInbound('stripe', {}, {});

      expect(result).toBeNull();
    });
  });

  describe('getEventHistory', () => {
    it('should return paginated webhook events', async () => {
      const mockResult = {
        items: [{ id: 'evt-1' }, { id: 'evt-2' }],
        total: 2,
        page: 1,
        limit: 20,
      };

      WebhookEvent.listByMerchant.mockResolvedValue(mockResult);

      const result = await WebhookService.getEventHistory('merchant-1', { page: 1 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('retryFailed', () => {
    it('should return failed events for retry', async () => {
      const failedEvents = [{ id: 'evt-1' }, { id: 'evt-2' }];
      WebhookEvent.getFailedEvents.mockResolvedValue(failedEvents);

      const result = await WebhookService.retryFailed();

      expect(result).toHaveLength(2);
    });
  });
});
