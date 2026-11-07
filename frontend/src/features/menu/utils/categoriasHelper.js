/**
 * Utilidades y detalles visuales para Categorías
 */

export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export const AVAILABLE_EMOJIS = [
  '☕', '🥤', '🧋', '🍵', '🧉', '🧃', '🍹', '🍸', '🍷', '🥂', '🍺', '🍻', '🥃', '🍾', '🧊',
  '🥪', '🍔', '🌭', '🌮', '🌯', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫',
  '🍰', '🎂', '🧁', '🥧', '🍮', '🍩', '🍪', '🍨', '🍧', '🍦', '🍫', '🍬', '🍭', '🍡', '🥐', '🥯', '🍞', '🥖', '🥨', '🥞', '🧇',
  '🍎', '🍏', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑',
  '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🍄', '🥜', '🌰',
  '🥩', '🍗', '🍖', '🥓', '🍤', '🍣', '🍱', '🍛', '🍜', '🍝', '🍢', '🍥', '🥮', '🥟', '🥠', '🥡', '🦀', '🦞', '🦐', '🦑', '🦪',
  '🌾', '🏪', '📦', '🛒', '🛍️', '🍽️', '🍴', '🥄', '🔪', '🏺'
];

export const getCategoryDetails = (categoryName) => {
  const name = normalizeText(categoryName);
  if (name.includes('cafe')) return { emoji: '☕', activeBg: 'bg-amber-100', activeBorder: 'border-amber-400' };
  if (name.includes('bebida') || name.includes('agua') || name.includes('jugo')) return { emoji: '🥤', activeBg: 'bg-blue-100', activeBorder: 'border-blue-400' };
  if (name.includes('pan') || name.includes('sandwich') || name.includes('tostado')) return { emoji: '🥪', activeBg: 'bg-orange-100', activeBorder: 'border-orange-400' };
  if (name.includes('dulce') || name.includes('postre') || name.includes('torta') || name.includes('alfajor') || name.includes('pastel')) return { emoji: '🍰', activeBg: 'bg-pink-100', activeBorder: 'border-pink-400' };
  if (name.includes('gluten') || name.includes('sintacc') || name.includes('celiaco') || name.includes('tacc')) return { emoji: '🌾', activeBg: 'bg-emerald-100', activeBorder: 'border-emerald-400' };
  if (name.includes('bowl') || name.includes('ensalada') || name.includes('vegano') || name.includes('vegetariano') || name.includes('yogur')) return { emoji: '🥗', activeBg: 'bg-green-100', activeBorder: 'border-green-400' };
  if (name.includes('kiosco') || name.includes('golosina') || name.includes('snack')) return { emoji: '🏪', activeBg: 'bg-purple-100', activeBorder: 'border-purple-400' };
  if (name.includes('carne') || name.includes('pollo')) return { emoji: '🍗', activeBg: 'bg-red-100', activeBorder: 'border-red-400' };
  if (name.includes('pescado') || name.includes('marisco')) return { emoji: '🍤', activeBg: 'bg-cyan-100', activeBorder: 'border-cyan-400' };
  if (name.includes('pasta') || name.includes('fideo') || name.includes('pizza')) return { emoji: '🍝', activeBg: 'bg-yellow-100', activeBorder: 'border-yellow-400' };

  return { emoji: '🍽️', activeBg: 'bg-amber-50', activeBorder: 'border-amber-300' };
};

export function obtenerEmojiCategoria(nombre) {
  return getCategoryDetails(nombre).emoji;
}
