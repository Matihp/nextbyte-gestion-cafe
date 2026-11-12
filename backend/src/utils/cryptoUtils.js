const crypto = require('crypto');

function canonicalize(valor) {
  if (valor === null || valor === undefined) return 'null';
  if (Array.isArray(valor)) {
    return `[${valor.map(canonicalize).join(',')}]`;
  }
  if (typeof valor === 'object') {
    const keys = Object.keys(valor).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(valor[k])}`).join(',')}}`;
  }
  return JSON.stringify(valor);
}

function hashCanonicalPayload(datos) {
  const canonical = canonicalize(datos);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function generarUUID() {
  return crypto.randomUUID();
}

module.exports = {
  canonicalize,
  hashCanonicalPayload,
  generarUUID
};

