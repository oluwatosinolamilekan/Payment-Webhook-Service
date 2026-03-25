const { db } = require('../src/config/database');
const logger = require('../src/config/logger');
const migration = require('./001_initial_schema');

async function runMigrations() {
  try {
    logger.info('Running migrations...');

    const hasTable = await db.schema.hasTable('merchants');
    if (hasTable) {
      logger.info('Tables already exist, skipping migration');
      process.exit(0);
    }

    await migration.up(db);
    logger.info('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', { error: error.message });
    process.exit(1);
  }
}

runMigrations();
