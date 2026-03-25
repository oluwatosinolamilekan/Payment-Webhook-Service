require('dotenv').config();

const { createWorker } = require('../config/queue');
const { processWebhookDelivery, processWebhookRetry } = require('./processors/webhookProcessor');
const logger = require('../config/logger');

logger.info('Starting queue workers...');

const deliveryWorker = createWorker('webhook-delivery', processWebhookDelivery, {
  concurrency: 10,
  limiter: {
    max: 100,
    duration: 1000,
  },
});

const retryWorker = createWorker('webhook-retry', processWebhookRetry, {
  concurrency: 1,
});

async function shutdown() {
  logger.info('Shutting down workers...');
  await deliveryWorker.close();
  await retryWorker.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

logger.info('Queue workers started', {
  workers: ['webhook-delivery', 'webhook-retry'],
});
