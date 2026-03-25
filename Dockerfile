FROM node:20-alpine AS base

RUN apk add --no-cache tini curl
WORKDIR /app

# ------- Dependencies -------
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production && \
    cp -R node_modules /prod_node_modules
RUN npm ci

# ------- Build & Test -------
FROM deps AS test
COPY . .
RUN npm run lint || true
RUN npm test

# ------- Production -------
FROM base AS production

ENV NODE_ENV=production

COPY --from=deps /prod_node_modules ./node_modules
COPY . .

RUN mkdir -p logs && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node src/monitoring/healthCheck.js

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/app.js"]
