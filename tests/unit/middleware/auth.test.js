const { authenticateApiKey } = require('../../../src/api/middleware/auth');
const Merchant = require('../../../src/models/Merchant');

jest.mock('../../../src/models/Merchant');
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticateApiKey', () => {
    it('should reject requests without API key', async () => {
      await authenticateApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 })
      );
    });

    it('should reject requests with invalid API key', async () => {
      req.headers['x-api-key'] = 'invalid-key';
      Merchant.findByApiKeyHash.mockResolvedValue(null);

      await authenticateApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 })
      );
    });

    it('should reject suspended merchants', async () => {
      req.headers['x-api-key'] = 'pk_test123';
      Merchant.findByApiKeyHash.mockResolvedValue({
        id: 'merchant-1',
        status: 'suspended',
      });

      await authenticateApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });

    it('should authenticate valid merchant and attach to request', async () => {
      const mockMerchant = { id: 'merchant-1', status: 'active', name: 'Test' };
      req.headers['x-api-key'] = 'pk_test123';
      Merchant.findByApiKeyHash.mockResolvedValue(mockMerchant);

      await authenticateApiKey(req, res, next);

      expect(req.merchant).toEqual(mockMerchant);
      expect(next).toHaveBeenCalledWith();
    });
  });
});
