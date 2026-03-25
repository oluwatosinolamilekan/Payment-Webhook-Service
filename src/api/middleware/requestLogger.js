const { v4: uuidv4 } = require('uuid');
const logger = require('../../config/logger');

function requestLogger(req, res, next) {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  req.startTime = Date.now();

  res.setHeader('X-Request-Id', req.requestId);

  const originalEnd = res.end.bind(res);
  res.end = function (...args) {
    const duration = Date.now() - req.startTime;
    logger.info('HTTP Request', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      merchantId: req.merchant?.id,
    });
    originalEnd(...args);
  };

  next();
}

module.exports = { requestLogger };
