const { db } = require('../config/database');

const TABLE = 'webhook_delivery_logs';

class WebhookDeliveryLog {
  static async create(data) {
    const [log] = await db(TABLE).insert(data).returning('*');
    return log;
  }

  static async findByEventId(webhookEventId) {
    return db(TABLE)
      .where({ webhook_event_id: webhookEventId })
      .orderBy('attempt_number', 'asc');
  }

  static async getLatestAttempt(webhookEventId) {
    return db(TABLE)
      .where({ webhook_event_id: webhookEventId })
      .orderBy('attempt_number', 'desc')
      .first();
  }
}

module.exports = WebhookDeliveryLog;
