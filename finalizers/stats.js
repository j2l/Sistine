const { Finalizer } = require('klasa');
const now = require('performance-now');

module.exports = class extends Finalizer {

  constructor(...args) {
    super(...args, {
      name: 'stats',
      enabled: true,
    });
  }

  run(msg, mes, start) {
    const time = now() - start;
    this.client.dogstatsd.timing('prod.queryTime', time);

  }

};