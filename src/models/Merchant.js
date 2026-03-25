const { db } = require('../config/database');

const TABLE = 'merchants';

class Merchant {
  static async findById(id) {
    return db(TABLE).where({ id }).first();
  }

  static async findByApiKeyHash(apiKeyHash) {
    return db(TABLE).where({ api_key_hash: apiKeyHash, status: 'active' }).first();
  }

  static async create(data) {
    const [merchant] = await db(TABLE).insert(data).returning('*');
    return merchant;
  }

  static async update(id, data) {
    const [merchant] = await db(TABLE)
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');
    return merchant;
  }

  static async list({ page = 1, limit = 20, status } = {}) {
    const query = db(TABLE).orderBy('created_at', 'desc');
    if (status) query.where({ status });
    const offset = (page - 1) * limit;
    const [items, [{ count }]] = await Promise.all([
      query.clone().limit(limit).offset(offset),
      db(TABLE).count('id'),
    ]);
    return { items, total: parseInt(count, 10), page, limit };
  }
}

module.exports = Merchant;
