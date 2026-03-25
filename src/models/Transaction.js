const { db } = require('../config/database');

const TABLE = 'transactions';

class Transaction {
  static async findById(id) {
    return db(TABLE).where({ id }).first();
  }

  static async findByExternalId(externalId, gateway) {
    return db(TABLE).where({ external_id: externalId, gateway }).first();
  }

  static async findByIdempotencyKey(key) {
    return db(TABLE).where({ idempotency_key: key }).first();
  }

  static async create(data, trx = null) {
    const query = trx ? trx(TABLE) : db(TABLE);
    const [transaction] = await query.insert(data).returning('*');
    return transaction;
  }

  static async updateStatus(id, status, extra = {}, trx = null) {
    const query = trx ? trx(TABLE) : db(TABLE);
    const [transaction] = await query
      .where({ id })
      .update({
        status,
        ...extra,
        updated_at: db.fn.now(),
        ...(status === 'completed' ? { processed_at: db.fn.now() } : {}),
      })
      .returning('*');
    return transaction;
  }

  static async listByMerchant(merchantId, { page = 1, limit = 20, status, type } = {}) {
    const query = db(TABLE)
      .where({ merchant_id: merchantId })
      .orderBy('created_at', 'desc');

    if (status) query.where({ status });
    if (type) query.where({ type });

    const offset = (page - 1) * limit;
    const countQuery = db(TABLE).where({ merchant_id: merchantId });
    if (status) countQuery.where({ status });
    if (type) countQuery.where({ type });

    const [items, [{ count }]] = await Promise.all([
      query.clone().limit(limit).offset(offset),
      countQuery.count('id'),
    ]);

    return { items, total: parseInt(count, 10), page, limit };
  }

  static async getStats(merchantId, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return db(TABLE)
      .where({ merchant_id: merchantId })
      .where('created_at', '>=', since)
      .select('status')
      .count('id as count')
      .sum('amount as total_amount')
      .groupBy('status');
  }
}

module.exports = Transaction;
