const request = require('supertest');
const app = require('../../src/app');

// Mock database and Redis for integration tests
jest.mock('../../src/config/database', () => ({
  db: {
    raw: jest.fn().mockResolvedValue(true),
    fn: { now: jest.fn(() => new Date()) },
  },
  testConnection: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/config/queue', () => ({
  redisConnection: {
    on: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
  },
  createQueue: jest.fn(() => ({
    add: jest.fn(),
    on: jest.fn(),
  })),
  createWorker: jest.fn(),
}));

jest.mock('../../src/monitoring/metrics', () => ({
  metrics: {
    httpRequestDuration: { observe: jest.fn() },
    activeConnections: { inc: jest.fn(), dec: jest.fn() },
    webhooksReceivedTotal: { inc: jest.fn() },
    webhooksDeliveredTotal: { inc: jest.fn() },
    paymentsTotal: { inc: jest.fn() },
    paymentProcessingDuration: { observe: jest.fn() },
    fraudBlockedTotal: { inc: jest.fn() },
  },
  register: { metrics: jest.fn(), contentType: 'text/plain' },
}));

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('API Integration Tests', () => {
  describe('Health Endpoints', () => {
    it('GET /health should return 200', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.uptime).toBeDefined();
    });

    it('GET /health/ready should check dependencies', async () => {
      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.checks).toBeDefined();
      expect(res.body.checks.database).toBeDefined();
      expect(res.body.checks.redis).toBeDefined();
      expect(res.body.checks.memory).toBeDefined();
    });
  });

  describe('Not Found Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/v1/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Payment Endpoints', () => {
    it('POST /api/v1/payments should require authentication', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .send({ amount: 100, currency: 'USD' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('Webhook Inbound', () => {
    it('should reject unsupported gateways', async () => {
      const res = await request(app)
        .post('/api/v1/webhooks/inbound/paypal')
        .send({ type: 'test' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Unsupported gateway');
    });
  });

  describe('Request Headers', () => {
    it('should return X-Request-Id header', async () => {
      const res = await request(app).get('/health');

      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('should echo back provided X-Request-Id', async () => {
      const requestId = 'test-request-123';
      const res = await request(app)
        .get('/health')
        .set('X-Request-Id', requestId);

      expect(res.headers['x-request-id']).toBe(requestId);
    });

    it('should include security headers from helmet', async () => {
      const res = await request(app).get('/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });
});
