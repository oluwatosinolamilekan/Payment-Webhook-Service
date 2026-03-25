const { db } = require('../src/config/database');
const logger = require('../src/config/logger');
const migration = require('./001_initial_schema');

async function rollback() {
  try {
    logger.info('Rolling back migrations...');
    await migration.down(db);
    logger.info('Rollback completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Rollback failed', { error: error.message });
    process.exit(1);
  }
}

rollback();
