/**
 * Initial schema for payment webhook processing system.
 * Covers merchants, transactions, webhook events, delivery logs, and idempotency.
 */

exports.up = async function (knex) {
  await knex.schema.createTable('merchants', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.string('api_key_hash').notNullable().unique();
    table.string('webhook_url').notNullable();
    table.string('webhook_secret').notNullable();
    table.enum('status', ['active', 'suspended', 'pending']).defaultTo('active');
    table.enum('risk_level', ['low', 'medium', 'high']).defaultTo('low');
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('api_key_hash');
    table.index('status');
  });

  await knex.schema.createTable('transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('merchant_id').notNullable().references('id').inTable('merchants').onDelete('RESTRICT');
    table.string('external_id').notNullable();
    table.string('gateway').notNullable();
    table.enum('type', ['payment', 'refund', 'payout', 'chargeback']).notNullable();
    table.enum('status', [
      'pending', 'processing', 'completed', 'failed',
      'cancelled', 'refunded', 'disputed',
    ]).defaultTo('pending');
    table.decimal('amount', 12, 2).notNullable();
    table.string('currency', 3).notNullable();
    table.string('card_last_four', 4);
    table.string('card_brand');
    table.string('customer_email');
    table.string('customer_ip');
    table.string('customer_country', 2);
    table.decimal('fraud_score', 5, 2).defaultTo(0);
    table.jsonb('gateway_response').defaultTo('{}');
    table.jsonb('metadata').defaultTo('{}');
    table.string('idempotency_key').unique();
    table.timestamp('processed_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('merchant_id');
    table.index('external_id');
    table.index('status');
    table.index('gateway');
    table.index('created_at');
    table.index(['merchant_id', 'status']);
  });

  await knex.schema.createTable('webhook_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('transaction_id').references('id').inTable('transactions').onDelete('SET NULL');
    table.uuid('merchant_id').notNullable().references('id').inTable('merchants').onDelete('CASCADE');
    table.string('event_type').notNullable();
    table.string('source_gateway').notNullable();
    table.jsonb('payload').notNullable();
    table.jsonb('headers').defaultTo('{}');
    table.enum('status', ['received', 'processing', 'delivered', 'failed', 'dead_letter']).defaultTo('received');
    table.integer('delivery_attempts').defaultTo(0);
    table.timestamp('last_attempt_at');
    table.timestamp('delivered_at');
    table.string('idempotency_key').unique();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('transaction_id');
    table.index('merchant_id');
    table.index('event_type');
    table.index('status');
    table.index('source_gateway');
    table.index('created_at');
  });

  await knex.schema.createTable('webhook_delivery_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('webhook_event_id').notNullable().references('id').inTable('webhook_events').onDelete('CASCADE');
    table.integer('attempt_number').notNullable();
    table.string('url').notNullable();
    table.integer('response_status');
    table.text('response_body');
    table.jsonb('request_headers').defaultTo('{}');
    table.integer('duration_ms');
    table.text('error_message');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('webhook_event_id');
    table.index('created_at');
  });

  await knex.schema.createTable('idempotency_keys', (table) => {
    table.string('key').primary();
    table.uuid('merchant_id').notNullable().references('id').inTable('merchants').onDelete('CASCADE');
    table.jsonb('response').notNullable();
    table.integer('status_code').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();

    table.index(['merchant_id', 'key']);
    table.index('expires_at');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('idempotency_keys');
  await knex.schema.dropTableIfExists('webhook_delivery_logs');
  await knex.schema.dropTableIfExists('webhook_events');
  await knex.schema.dropTableIfExists('transactions');
  await knex.schema.dropTableIfExists('merchants');
};
