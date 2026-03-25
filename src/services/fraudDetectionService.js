const logger = require('../config/logger');

const HIGH_RISK_COUNTRIES = new Set(['NG', 'GH', 'KE', 'UA', 'RU', 'CN', 'VN']);
const VELOCITY_WINDOW_MS = 3600000; // 1 hour

const recentTransactions = new Map();

class FraudDetectionService {
  /**
   * Analyze a transaction for fraud indicators.
   * Returns a score 0-100 and list of triggered rules.
   */
  static analyze(transactionData, merchant) {
    const rules = [];
    let score = 0;

    // Rule 1: High-risk country
    if (transactionData.customer_country &&
        HIGH_RISK_COUNTRIES.has(transactionData.customer_country.toUpperCase())) {
      score += 15;
      rules.push({ rule: 'high_risk_country', weight: 15 });
    }

    // Rule 2: Large transaction amount
    const amountThreshold = merchant.risk_level === 'high' ? 5000 : 10000;
    if (transactionData.amount > amountThreshold) {
      score += 20;
      rules.push({ rule: 'large_amount', weight: 20, threshold: amountThreshold });
    }

    // Rule 3: Velocity check (too many transactions from same IP)
    const velocityScore = this._checkVelocity(
      transactionData.customer_ip,
      transactionData.merchant_id
    );
    if (velocityScore > 0) {
      score += velocityScore;
      rules.push({ rule: 'velocity_exceeded', weight: velocityScore });
    }

    // Rule 4: Missing customer data
    if (!transactionData.customer_email || !transactionData.customer_ip) {
      score += 10;
      rules.push({ rule: 'missing_customer_data', weight: 10 });
    }

    // Rule 5: Currency mismatch with customer country
    if (transactionData.customer_country && transactionData.currency) {
      const mismatch = this._checkCurrencyMismatch(
        transactionData.customer_country,
        transactionData.currency
      );
      if (mismatch) {
        score += 10;
        rules.push({ rule: 'currency_country_mismatch', weight: 10 });
      }
    }

    // Rule 6: Merchant risk level amplifier
    const riskMultiplier = { low: 1, medium: 1.2, high: 1.5 };
    score = Math.round(score * (riskMultiplier[merchant.risk_level] || 1));
    score = Math.min(score, 100);

    const decision = score >= 80 ? 'block' : score >= 50 ? 'review' : 'allow';

    logger.info('Fraud analysis completed', {
      merchantId: merchant.id,
      score,
      decision,
      rulesTriggered: rules.length,
    });

    return { score, decision, rules };
  }

  static _checkVelocity(ip, merchantId) {
    if (!ip) return 0;

    const key = `${merchantId}:${ip}`;
    const now = Date.now();
    const txns = recentTransactions.get(key) || [];

    const recentTxns = txns.filter((t) => now - t < VELOCITY_WINDOW_MS);
    recentTxns.push(now);
    recentTransactions.set(key, recentTxns);

    if (recentTxns.length > 20) return 30;
    if (recentTxns.length > 10) return 15;
    if (recentTxns.length > 5) return 5;
    return 0;
  }

  static _checkCurrencyMismatch(country, currency) {
    const countyCurrencyMap = {
      US: 'USD', GB: 'GBP', EU: 'EUR', DE: 'EUR', FR: 'EUR',
      JP: 'JPY', CA: 'CAD', AU: 'AUD', BR: 'BRL',
    };
    const expected = countyCurrencyMap[country.toUpperCase()];
    return expected && expected !== currency.toUpperCase();
  }

  static clearVelocityCache() {
    recentTransactions.clear();
  }
}

module.exports = FraudDetectionService;
