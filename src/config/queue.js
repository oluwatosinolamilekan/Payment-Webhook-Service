const { Queue, Worker, QueueScheduler } = require('bullmq');
const IORedis = require('ioredis');
const config = require('./index');
const logger = require('./logger');

const redisConnection = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on('connect', () => {
  logger.info('Redis connection established');
});

redisConnection.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});

function createQueue(name, opts = {}) {
  return new Queue(name, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
      attempts: config.webhook.retryAttempts,
      backoff: {
        type: 'exponential',
        delay: config.webhook.retryDelay,
      },
    },
    ...opts,
  });
}

function createWorker(name, processor, opts = {}) {
  const worker = new Worker(name, processor, {
    connection: redisConnection,
    concurrency: config.queue.concurrency,
    ...opts,
  });

  worker.on('completed', (job) => {
    logger.info(`Job completed`, { queue: name, jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job failed`, {
      queue: name,
      jobId: job?.id,
      error: err.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error(`Worker error`, { queue: name, error: err.message });
  });

  return worker;
}

module.exports = { redisConnection, createQueue, createWorker };
