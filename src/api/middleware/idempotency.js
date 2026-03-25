const IdempotencyKey = require('../../models/IdempotencyKey');
const logger = require('../../config/logger');

function idempotencyCheck(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key) return next();

  req.idempotencyKey = key;

  const originalJson = res.json.bind(res);
  res.json = async function (data) {
    if (res.statusCode < 400 && req.merchant) {
      try {
        await IdempotencyKey.create({
          key,
          merchant_id: req.merchant.id,
          response: data,
          status_code: res.statusCode,
        });
      } catch (err) {
        logger.debug('Idempotency key already exists', { key });
      }
    }
    return originalJson(data);
  };

  if (!req.merchant) return next();

  IdempotencyKey.find(key, req.merchant.id)
    .then((existing) => {
      if (existing) {
        logger.info('Returning cached idempotent response', { key });
        return res.status(existing.status_code).json(existing.response);
      }
      next();
    })
    .catch(next);
}

module.exports = { idempotencyCheck };
