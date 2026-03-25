const {
  generateSignature,
  verifySignature,
  hashApiKey,
  generateIdempotencyKey,
} = require('../../../src/utils/crypto');

describe('Crypto Utilities', () => {
  describe('generateSignature / verifySignature', () => {
    const secret = 'test-secret';
    const payload = { event: 'payment.completed', amount: 100 };

    it('should generate a valid HMAC-SHA256 signature', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateSignature(payload, secret, timestamp);

      expect(signature).toBeDefined();
      expect(signature).toHaveLength(64); // hex-encoded SHA256
    });

    it('should verify a valid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateSignature(payload, secret, timestamp);
      const sigString = `t=${timestamp},v1=${signature}`;

      const result = verifySignature(payload, sigString, secret);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeNull();
    });

    it('should reject an expired signature', () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
      const signature = generateSignature(payload, secret, oldTimestamp);
      const sigString = `t=${oldTimestamp},v1=${signature}`;

      const result = verifySignature(payload, sigString, secret, 300);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('tolerance');
    });

    it('should reject an invalid signature format', () => {
      const result = verifySignature(payload, 'invalid-format', secret);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid signature format');
    });

    it('should reject a tampered signature', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateSignature(payload, secret, timestamp);
      const tamperedSig = signature.replace(signature[0], signature[0] === 'a' ? 'b' : 'a');
      const sigString = `t=${timestamp},v1=${tamperedSig}`;

      const result = verifySignature(payload, sigString, secret);

      expect(result.valid).toBe(false);
    });
  });

  describe('hashApiKey', () => {
    it('should produce consistent hashes', () => {
      const key = 'pk_test_abc123';
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different keys', () => {
      const hash1 = hashApiKey('key1');
      const hash2 = hashApiKey('key2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateIdempotencyKey', () => {
    it('should generate a UUID', () => {
      const key = generateIdempotencyKey();
      expect(key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('should generate unique keys', () => {
      const keys = new Set(Array.from({ length: 100 }, () => generateIdempotencyKey()));
      expect(keys.size).toBe(100);
    });
  });
});
