const knex = require('knex');
const config = require('./index');
const logger = require('./logger');

const knexConfig = {
  client: 'pg',
  connection: {
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
  },
  pool: {
    min: config.db.pool.min,
    max: config.db.pool.max,
    afterCreate: (conn, done) => {
      conn.query('SET timezone = "UTC";', (err) => {
        done(err, conn);
      });
    },
  },
  acquireConnectionTimeout: 10000,
};

const db = knex(knexConfig);

db.on('query', (queryData) => {
  logger.debug('SQL Query', {
    sql: queryData.sql,
    bindings: queryData.bindings,
  });
});

db.on('query-error', (error, queryData) => {
  logger.error('SQL Query Error', {
    error: error.message,
    sql: queryData.sql,
  });
});

async function testConnection() {
  try {
    await db.raw('SELECT 1');
    logger.info('Database connection established');
    return true;
  } catch (error) {
    logger.error('Database connection failed', { error: error.message });
    return false;
  }
}

module.exports = { db, testConnection, knexConfig };
