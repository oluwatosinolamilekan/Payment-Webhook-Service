const WebhookService = require('../../services/webhookService');
const NotificationService = require('../../services/notificationService');
const logger = require('../../config/logger');

async function processWebhookDelivery(job) {
  const { eventId } = job.data;

  logger.info('Processing webhook delivery', {
    jobId: job.id,
    eventId,
    attempt: job.attemptsMade + 1,
  });

  try {
    await WebhookService.deliverToMerchant(eventId);
  } catch (error) {
    logger.error('Webhook delivery failed', {
      jobId: job.id,
      eventId,
      attempt: job.attemptsMade + 1,
      error: error.message,
    });

    if (job.attemptsMade + 1 >= job.opts.attempts) {
      await NotificationService.sendAlert('webhook_dead_letter', {
        eventId,
        attempts: job.attemptsMade + 1,
      });
    }

    throw error;
  }
}

async function processWebhookRetry(job) {
  logger.info('Processing webhook retry batch', { jobId: job.id });

  const failedEvents = await WebhookService.retryFailed();
  const { webhookDeliveryQueue } = require('../webhookQueue');

  for (const event of failedEvents) {
    await webhookDeliveryQueue.add('deliver', { eventId: event.id }, {
      priority: 3,
      delay: Math.random() * 5000,
    });
  }

  logger.info(`Queued ${failedEvents.length} webhook events for retry`);
}

module.exports = { processWebhookDelivery, processWebhookRetry };
