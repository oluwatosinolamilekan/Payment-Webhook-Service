const { db } = require('../config/database');

const TABLE = 'idempotency_keys';

class IdempotencyKey {
  static async find(key, merchantId) {
    return db(TABLE)
      .where({ key, merchant_id: merchantId })
      .where('expires_at', '>', db.fn.now())
      .first();
  }

  static async create(data) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const [record] = await db(TABLE)
      .insert({ ...data, expires_at: expiresAt })
      .returning('*');
    return record;
  }

  static async cleanup() {
    const deleted = await db(TABLE)
      .where('expires_at', '<', db.fn.now())
      .delete();
    return deleted;
  }
}

module.exports = IdempotencyKey;
