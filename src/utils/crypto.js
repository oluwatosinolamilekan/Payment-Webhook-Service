const crypto = require('crypto');

function generateSignature(payload, secret, timestamp) {
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  return crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
}

function verifySignature(payload, signature, secret, toleranceSeconds = 300) {
  const parts = signature.split(',');
  const timestampPart = parts.find((p) => p.startsWith('t='));
  const sigPart = parts.find((p) => p.startsWith('v1='));

  if (!timestampPart || !sigPart) {
    return { valid: false, reason: 'Invalid signature format' };
  }

  const timestamp = parseInt(timestampPart.split('=')[1], 10);
  const receivedSig = sigPart.split('=')[1];

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return { valid: false, reason: 'Timestamp outside tolerance window' };
  }

  const expectedSig = generateSignature(payload, secret, timestamp);
  const isValid = crypto.timingSafeEqual(
    Buffer.from(receivedSig, 'hex'),
    Buffer.from(expectedSig, 'hex')
  );

  return { valid: isValid, reason: isValid ? null : 'Signature mismatch' };
}

function generateIdempotencyKey() {
  return crypto.randomUUID();
}

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

module.exports = {
  generateSignature,
  verifySignature,
  generateIdempotencyKey,
  hashApiKey,
};
