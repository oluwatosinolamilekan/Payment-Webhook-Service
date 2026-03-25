const { db } = require('../config/database');

const TABLE = 'webhook_events';

class WebhookEvent {
  static async findById(id) {
    return db(TABLE).where({ id }).first();
  }

  static async findByIdempotencyKey(key) {
    return db(TABLE).where({ idempotency_key: key }).first();
  }

  static async create(data, trx = null) {
    const query = trx ? trx(TABLE) : db(TABLE);
    const [event] = await query.insert(data).returning('*');
    return event;
  }

  static async updateStatus(id, status, extra = {}) {
    const [event] = await db(TABLE)
      .where({ id })
      .update({ status, ...extra })
      .returning('*');
    return event;
  }

  static async incrementDeliveryAttempts(id) {
    const [event] = await db(TABLE)
      .where({ id })
      .increment('delivery_attempts', 1)
      .update({ last_attempt_at: db.fn.now() })
      .returning('*');
    return event;
  }

  static async getFailedEvents(limit = 100) {
    return db(TABLE)
      .where({ status: 'failed' })
      .where('delivery_attempts', '<', 5)
      .orderBy('created_at', 'asc')
      .limit(limit);
  }

  static async moveToDeadLetter(id) {
    return this.updateStatus(id, 'dead_letter');
  }

  static async listByMerchant(merchantId, { page = 1, limit = 20, status, eventType } = {}) {
    const query = db(TABLE)
      .where({ merchant_id: merchantId })
      .orderBy('created_at', 'desc');

    if (status) query.where({ status });
    if (eventType) query.where({ event_type: eventType });

    const offset = (page - 1) * limit;
    const [items, [{ count }]] = await Promise.all([
      query.clone().limit(limit).offset(offset),
      db(TABLE).where({ merchant_id: merchantId }).count('id'),
    ]);

    return { items, total: parseInt(count, 10), page, limit };
  }
}

module.exports = WebhookEvent;
