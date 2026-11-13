const { hashCanonicalPayload } = require('../utils/cryptoUtils');

class EffectCollector {
  constructor() {
    this.effects = [];
  }

  recordInsert(table, id, data) {
    this.effects.push({
      table,
      op: 'INSERT',
      id,
      data: JSON.parse(JSON.stringify(data))
    });
  }

  recordUpdate(table, id, data, previousData = null) {
    this.effects.push({
      table,
      op: 'UPDATE',
      id,
      data: JSON.parse(JSON.stringify(data)),
      previousData: previousData ? JSON.parse(JSON.stringify(previousData)) : null
    });
  }

  recordDelete(table, id, previousData = null) {
    this.effects.push({
      table,
      op: 'DELETE',
      id,
      previousData: previousData ? JSON.parse(JSON.stringify(previousData)) : null
    });
  }

  getEffects() {
    return this.effects;
  }

  getEffectsHash() {
    return hashCanonicalPayload(this.effects);
  }
}

module.exports = { EffectCollector };

