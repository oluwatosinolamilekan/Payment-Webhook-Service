const { createQueue } = require('../config/queue');

const webhookDeliveryQueue = createQueue('webhook-delivery', {
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 10000, // 10s, 20s, 40s, 80s, 160s
    },
    removeOnComplete: { count: 1000, age: 86400 },
    removeOnFail: { count: 5000, age: 604800 },
  },
});

const webhookRetryQueue = createQueue('webhook-retry', {
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true,
  },
});

module.exports = { webhookDeliveryQueue, webhookRetryQueue };
