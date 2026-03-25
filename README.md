# Payment Webhook Service

A production-grade payment webhook processing platform built for fintech operations. Handles inbound webhooks from multiple payment gateways (Stripe, Adyen), processes transactions with fraud detection, and reliably delivers normalized events to merchants with exponential retry logic.

## Architecture

```
┌────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Stripe/Adyen  │────▶│   Webhook API    │────▶│   Redis Queue   │
│   Gateways     │     │  (Express.js)    │     │   (BullMQ)      │
└────────────────┘     └──────┬───────────┘     └────────┬────────┘
                              │                          │
                    ┌─────────▼─────────┐     ┌──────────▼────────┐
                    │   PostgreSQL      │     │   Queue Worker    │
                    │   (Transactions,  │     │   (Delivery,      │
                    │    Events, Logs)  │     │    Retry Logic)   │
                    └───────────────────┘     └──────────┬────────┘
                                                         │
                    ┌───────────────────┐     ┌──────────▼────────┐
                    │   Prometheus +    │     │  Merchant Webhook │
                    │   Grafana         │◀────│  Endpoints        │
                    └───────────────────┘     └───────────────────┘
```

## Key Features

- **Multi-Gateway Support** — Stripe and Adyen with a pluggable gateway abstraction (`BaseGateway`)
- **Webhook Signature Verification** — HMAC-SHA256 with timestamp tolerance to prevent replay attacks
- **Fraud Detection Engine** — Rule-based scoring: velocity checks, geo-risk, amount thresholds, currency mismatch
- **Reliable Delivery** — BullMQ queues with exponential backoff (5 retries), dead-letter queue for permanent failures
- **Idempotency** — Deduplication at both inbound (gateway) and outbound (merchant) layers
- **Transactional Safety** — PostgreSQL transactions with proper isolation for payment state changes
- **Monitoring** — Prometheus metrics, structured JSON logging (Winston), health/readiness probes
- **Rate Limiting** — Per-merchant and per-gateway rate limits
- **Security** — Helmet headers, API key auth with SHA-256 hashing, input validation (Joi)

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express.js |
| Database | PostgreSQL 16 |
| Queue | Redis 7 + BullMQ |
| Logging | Winston (structured JSON) |
| Metrics | Prometheus (prom-client) |
| Validation | Joi |
| Testing | Jest + Supertest |
| Containers | Docker + Docker Compose |
| CI/CD | GitHub Actions |

## Quick Start

### Prerequisites

- Node.js >= 18
- Docker & Docker Compose

### Using Docker Compose (recommended)

```bash
# Clone and start all services
cp .env.example .env
docker-compose up -d

# Run database migrations
docker-compose exec api node migrations/run.js

# Verify health
curl http://localhost:3000/health
```

### Local Development

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Start PostgreSQL and Redis (via Docker)
docker-compose up -d postgres redis

# Run migrations
npm run migrate

# Start development server
npm run dev

# Start queue worker (separate terminal)
npm run queue:worker
```

## API Reference

### Merchants

```bash
# Register a new merchant
POST /api/v1/merchants
{
  "name": "Acme Corp",
  "webhook_url": "https://acme.com/webhooks",
  "risk_level": "low"
}

# Get merchant profile
GET /api/v1/merchants/me
Headers: X-API-Key: pk_...
```

### Payments

```bash
# Create a payment
POST /api/v1/payments
Headers: X-API-Key: pk_..., Idempotency-Key: unique-key-123
{
  "amount": 99.99,
  "currency": "USD",
  "gateway": "stripe",
  "customer_email": "user@example.com",
  "customer_ip": "192.168.1.1",
  "customer_country": "US"
}

# List transactions
GET /api/v1/payments?page=1&limit=20&status=completed

# Get transaction details
GET /api/v1/payments/:id

# Refund a payment
POST /api/v1/payments/:id/refund
{ "amount": 50.00 }

# Get payment statistics
GET /api/v1/payments/stats?days=30
```

### Webhooks

```bash
# Inbound webhook from gateway (no auth — verified by signature)
POST /api/v1/webhooks/inbound/stripe
POST /api/v1/webhooks/inbound/adyen

# List webhook events
GET /api/v1/webhooks/events?page=1&status=delivered

# Get delivery logs for an event
GET /api/v1/webhooks/events/:id/deliveries

# Retry a failed webhook
POST /api/v1/webhooks/events/:id/retry
```

### Health & Monitoring

```bash
GET /health              # Liveness probe
GET /health/ready        # Readiness probe (checks DB + Redis)
GET /health/metrics      # Prometheus metrics
```

## Testing

```bash
# Run all tests with coverage
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode
npm run test:watch
```

## Project Structure

```
payment-webhook-service/
├── src/
│   ├── api/
│   │   ├── middleware/     # Auth, rate-limit, idempotency, logging, errors
│   │   ├── routes/         # REST endpoints (webhooks, payments, merchants, health)
│   │   └── validators/     # Joi request validation schemas
│   ├── config/             # Database, Redis, logger, app config
│   ├── integrations/       # Payment gateway adapters (Stripe, Adyen, base class)
│   ├── models/             # Data access layer (Merchant, Transaction, WebhookEvent)
│   ├── monitoring/         # Prometheus metrics, health checks
│   ├── queues/             # BullMQ queue definitions and worker processors
│   ├── services/           # Business logic (payment, webhook, fraud, notification)
│   ├── utils/              # Crypto helpers, error classes
│   └── app.js              # Express application entry point
├── tests/
│   ├── unit/               # Service, middleware, and utility tests
│   └── integration/        # API endpoint tests
├── migrations/             # PostgreSQL schema migrations
├── monitoring/             # Prometheus config
├── Dockerfile              # Multi-stage production build
├── Dockerfile.worker       # Queue worker container
├── docker-compose.yml      # Full stack (API, worker, PG, Redis, Prometheus, Grafana)
├── .gitlab-ci.yml          # Legacy GitLab CI pipeline
└── .github/workflows/      # GitHub Actions CI (test → docker build)
```

## Design Decisions

### Why queues for webhook delivery?
Direct HTTP delivery during request processing creates tight coupling and timeout risk. BullMQ provides retry with exponential backoff, dead-letter queues, concurrency control, and rate limiting — critical for reliable delivery at scale.

### Why signature verification on both sides?
Inbound signatures (from gateways) prevent spoofed webhook events. Outbound signatures (to merchants) let them verify authenticity. Both use HMAC-SHA256 with timestamps to prevent replay attacks.

### Why an in-memory fraud engine?
For a payment platform processing globally, real-time fraud scoring before gateway submission prevents chargebacks. The rule-based engine (velocity, geo-risk, amount, data completeness) runs in <1ms and can be extended with ML models.

### Why idempotency at multiple layers?
Payment systems must handle duplicate events gracefully. Gateway webhooks can be sent multiple times, and merchant API calls can be retried. Idempotency keys at the database level ensure exactly-once processing.

## Monitoring & Observability

The service exposes Prometheus metrics at `/health/metrics`:

- `pay4x_payments_total` — Payment count by gateway, status, merchant
- `pay4x_payment_processing_duration_seconds` — Processing latency histogram
- `pay4x_webhooks_received_total` — Inbound webhook count by gateway and type
- `pay4x_webhooks_delivered_total` — Outbound delivery success/failure/dead-letter
- `pay4x_fraud_blocked_total` — Blocked transactions count
- `pay4x_http_request_duration_seconds` — HTTP request latency
- `pay4x_queue_depth` — Queue backlog monitoring

Grafana is available at `http://localhost:3001` (admin/admin) when using Docker Compose.

## License

MIT
