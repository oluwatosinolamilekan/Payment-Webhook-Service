const StripeGateway = require('./StripeGateway');
const AdyenGateway = require('./AdyenGateway');
const config = require('../config');

const gateways = new Map();

function getGateway(name) {
  if (gateways.has(name)) {
    return gateways.get(name);
  }

  let gateway;
  switch (name) {
    case 'stripe':
      gateway = new StripeGateway(config.gateways.stripe);
      break;
    case 'adyen':
      gateway = new AdyenGateway(config.gateways.adyen);
      break;
    default:
      throw new Error(`Unknown gateway: ${name}`);
  }

  gateways.set(name, gateway);
  return gateway;
}

function getSupportedGateways() {
  return ['stripe', 'adyen'];
}

module.exports = { getGateway, getSupportedGateways };
