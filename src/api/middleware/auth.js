const Merchant = require('../../models/Merchant');
const { hashApiKey } = require('../../utils/crypto');
const { AuthenticationError, ForbiddenError } = require('../../utils/errors');

async function authenticateApiKey(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      throw new AuthenticationError('Missing API key');
    }

    const apiKeyHash = hashApiKey(apiKey);
    const merchant = await Merchant.findByApiKeyHash(apiKeyHash);

    if (!merchant) {
      throw new AuthenticationError('Invalid API key');
    }

    if (merchant.status === 'suspended') {
      throw new ForbiddenError('Merchant account is suspended');
    }

    req.merchant = merchant;
    next();
  } catch (error) {
    next(error);
  }
}

function requireMerchantStatus(...statuses) {
  return (req, res, next) => {
    if (!req.merchant) {
      return next(new AuthenticationError());
    }
    if (!statuses.includes(req.merchant.status)) {
      return next(new ForbiddenError(`Merchant status must be one of: ${statuses.join(', ')}`));
    }
    next();
  };
}

module.exports = { authenticateApiKey, requireMerchantStatus };
