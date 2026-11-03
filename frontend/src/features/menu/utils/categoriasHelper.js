export function obtenerEmojiCategoria(nombre) {
  if (!nombre) return '☕';
  const n = nombre.toUpperCase().trim();
  if (n.includes('CAFETER') || n.includes('CAFÉ') || n.includes('CAFE')) return '☕';
  if (n.includes('BEBIDA')) return '🥤';
  if (n.includes('PAN') || n.includes('SANDWICH') || n.includes('TOSTADO')) return '🥪';
  if (n.includes('DULCE') || n.includes('POSTRE') || n.includes('PASTEL') || n.includes('TORTA')) return '🍰';
  if (n.includes('GLUTEN') || n.includes('GF') || n.includes('CELIACO') || n.includes('TACC')) return '🌾';
  if (n.includes('BOWL') || n.includes('ENSALADA') || n.includes('YOGUR')) return '🥗';
  if (n.includes('KIOSCO') || n.includes('SNACK') || n.includes('GOLOSINA')) return '🏪';
  return '🍽️';
}

