require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const logger = require('./config/logger');
const { testConnection } = require('./config/database');
const { requestLogger } = require('./api/middleware/requestLogger');
const { errorHandler, notFoundHandler } = require('./api/middleware/errorHandler');
const { apiLimiter } = require('./api/middleware/rateLimiter');
const { metrics } = require('./monitoring/metrics');

const healthRoutes = require('./api/routes/health');
const webhookRoutes = require('./api/routes/webhooks');
const paymentRoutes = require('./api/routes/payments');
const merchantRoutes = require('./api/routes/merchants');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(requestLogger);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    metrics.httpRequestDuration.observe(
      { method: req.method, route: req.route?.path || req.path, status_code: res.statusCode },
      duration
    );
  });
  next();
});

const prefix = `/api/${config.apiVersion}`;

app.use('/health', healthRoutes);
app.use(`${prefix}/webhooks`, webhookRoutes);
app.use(`${prefix}/payments`, apiLimiter, paymentRoutes);
app.use(`${prefix}/merchants`, apiLimiter, merchantRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  if (process.env.SKIP_DB_CHECK !== 'true') {
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error('Cannot start without database connection');
      process.exit(1);
    }
  }

  const server = app.listen(config.port, () => {
    logger.info(`Payment Webhook Service started`, {
      port: config.port,
      env: config.env,
      apiVersion: config.apiVersion,
    });
  });

  server.on('connection', () => metrics.activeConnections.inc());
  server.on('close', () => metrics.activeConnections.dec());

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection', { error: reason?.message || reason });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });
}

if (require.main === module) {
  start();
}

module.exports = app;
