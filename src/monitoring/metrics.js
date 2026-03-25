const promClient = require('prom-client');

promClient.collectDefaultMetrics({
  prefix: 'pay4x_',
  labels: { service: 'payment-webhook' },
});

const metrics = {
  paymentsTotal: new promClient.Counter({
    name: 'pay4x_payments_total',
    help: 'Total number of payment transactions',
    labelNames: ['gateway', 'status', 'merchant_id'],
  }),

  paymentProcessingDuration: new promClient.Histogram({
    name: 'pay4x_payment_processing_duration_seconds',
    help: 'Payment processing duration in seconds',
    labelNames: ['gateway'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  }),

  webhooksReceivedTotal: new promClient.Counter({
    name: 'pay4x_webhooks_received_total',
    help: 'Total number of webhooks received from gateways',
    labelNames: ['gateway', 'event_type'],
  }),

  webhooksDeliveredTotal: new promClient.Counter({
    name: 'pay4x_webhooks_delivered_total',
    help: 'Total number of webhook deliveries to merchants',
    labelNames: ['status'],
  }),

  webhookDeliveryDuration: new promClient.Histogram({
    name: 'pay4x_webhook_delivery_duration_seconds',
    help: 'Webhook delivery duration in seconds',
    labelNames: ['merchant_id'],
    buckets: [0.5, 1, 2, 5, 10, 30],
  }),

  fraudBlockedTotal: new promClient.Counter({
    name: 'pay4x_fraud_blocked_total',
    help: 'Total number of transactions blocked by fraud detection',
    labelNames: ['merchant_id'],
  }),

  activeConnections: new promClient.Gauge({
    name: 'pay4x_active_connections',
    help: 'Number of active HTTP connections',
  }),

  queueDepth: new promClient.Gauge({
    name: 'pay4x_queue_depth',
    help: 'Number of jobs in queue',
    labelNames: ['queue_name', 'status'],
  }),

  httpRequestDuration: new promClient.Histogram({
    name: 'pay4x_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  }),
};

module.exports = { metrics, register: promClient.register };
