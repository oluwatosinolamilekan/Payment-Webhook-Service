const { Router } = require('express');
const { db } = require('../../config/database');
const { redisConnection } = require('../../config/queue');

const router = Router();

/**
 * GET /health
 * Basic health check.
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

/**
 * GET /health/ready
 * Readiness probe — checks all dependencies.
 */
router.get('/ready', async (req, res) => {
  const checks = {};

  try {
    await db.raw('SELECT 1');
    checks.database = { status: 'ok' };
  } catch (error) {
    checks.database = { status: 'error', message: error.message };
  }

  try {
    const pong = await redisConnection.ping();
    checks.redis = { status: pong === 'PONG' ? 'ok' : 'error' };
  } catch (error) {
    checks.redis = { status: 'error', message: error.message };
  }

  checks.memory = {
    status: 'ok',
    usage: process.memoryUsage(),
  };

  const allHealthy = Object.values(checks).every((c) => c.status === 'ok');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
});

/**
 * GET /health/metrics
 * Prometheus-compatible metrics endpoint.
 */
router.get('/metrics', async (req, res) => {
  try {
    const { register } = require('prom-client');
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

module.exports = router;
