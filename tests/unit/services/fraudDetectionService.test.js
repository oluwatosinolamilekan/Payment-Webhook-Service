const FraudDetectionService = require('../../../src/services/fraudDetectionService');

describe('FraudDetectionService', () => {
  const baseMerchant = {
    id: 'merchant-1',
    risk_level: 'low',
  };

  const baseTransaction = {
    merchant_id: 'merchant-1',
    amount: 100,
    currency: 'USD',
    customer_email: 'user@example.com',
    customer_ip: '192.168.1.1',
    customer_country: 'US',
  };

  beforeEach(() => {
    FraudDetectionService.clearVelocityCache();
  });

  describe('analyze', () => {
    it('should allow normal transactions with low score', () => {
      const result = FraudDetectionService.analyze(baseTransaction, baseMerchant);

      expect(result.score).toBeLessThan(50);
      expect(result.decision).toBe('allow');
      expect(result.rules).toBeDefined();
    });

    it('should flag high-risk country transactions', () => {
      const txn = { ...baseTransaction, customer_country: 'NG' };
      const result = FraudDetectionService.analyze(txn, baseMerchant);

      expect(result.score).toBeGreaterThanOrEqual(15);
      expect(result.rules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ rule: 'high_risk_country' }),
        ])
      );
    });

    it('should flag large amount transactions', () => {
      const txn = { ...baseTransaction, amount: 15000 };
      const result = FraudDetectionService.analyze(txn, baseMerchant);

      expect(result.rules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ rule: 'large_amount' }),
        ])
      );
    });

    it('should use lower threshold for high-risk merchants', () => {
      const merchant = { ...baseMerchant, risk_level: 'high' };
      const txn = { ...baseTransaction, amount: 6000 };
      const result = FraudDetectionService.analyze(txn, merchant);

      expect(result.rules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ rule: 'large_amount' }),
        ])
      );
    });

    it('should flag missing customer data', () => {
      const txn = { ...baseTransaction, customer_email: null, customer_ip: null };
      const result = FraudDetectionService.analyze(txn, baseMerchant);

      expect(result.rules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ rule: 'missing_customer_data' }),
        ])
      );
    });

    it('should flag currency-country mismatch', () => {
      const txn = { ...baseTransaction, customer_country: 'GB', currency: 'USD' };
      const result = FraudDetectionService.analyze(txn, baseMerchant);

      expect(result.rules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ rule: 'currency_country_mismatch' }),
        ])
      );
    });

    it('should block transactions with very high fraud scores', () => {
      const txn = {
        ...baseTransaction,
        amount: 50000,
        customer_country: 'NG',
        customer_email: null,
        customer_ip: null,
        currency: 'GBP',
      };
      const merchant = { ...baseMerchant, risk_level: 'high' };
      const result = FraudDetectionService.analyze(txn, merchant);

      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(['block', 'review']).toContain(result.decision);
    });

    it('should apply risk multiplier for high-risk merchants', () => {
      const txn = { ...baseTransaction, amount: 15000, customer_country: 'NG' };

      const lowRisk = FraudDetectionService.analyze(txn, { ...baseMerchant, risk_level: 'low' });
      const highRisk = FraudDetectionService.analyze(txn, { ...baseMerchant, risk_level: 'high' });

      expect(highRisk.score).toBeGreaterThan(lowRisk.score);
    });

    it('should cap score at 100', () => {
      const txn = {
        ...baseTransaction,
        amount: 100000,
        customer_country: 'RU',
        customer_email: null,
        customer_ip: null,
        currency: 'GBP',
      };
      const merchant = { ...baseMerchant, risk_level: 'high' };
      const result = FraudDetectionService.analyze(txn, merchant);

      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('velocity check', () => {
    it('should detect high transaction velocity from same IP', () => {
      const txn = { ...baseTransaction, customer_ip: '10.0.0.1' };

      // Simulate multiple rapid transactions
      for (let i = 0; i < 12; i++) {
        FraudDetectionService.analyze(txn, baseMerchant);
      }

      const result = FraudDetectionService.analyze(txn, baseMerchant);
      expect(result.rules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ rule: 'velocity_exceeded' }),
        ])
      );
    });
  });
});
