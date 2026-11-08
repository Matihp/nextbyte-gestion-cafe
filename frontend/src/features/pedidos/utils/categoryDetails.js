export function normalizeText(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function getCategoryDetails(categoryName) {
  const name = normalizeText(categoryName);
  
  if (name.includes('cafe')) {
    return { emoji: '☕', activeBg: 'bg-amber-100', activeBorder: 'border-amber-400' };
  }
  if (name.includes('bebida') || name.includes('agua') || name.includes('jugo')) {
    return { emoji: '🥤', activeBg: 'bg-blue-100', activeBorder: 'border-blue-400' };
  }
  if (name.includes('pan') || name.includes('sandwich') || name.includes('tostado')) {
    return { emoji: '🥪', activeBg: 'bg-orange-100', activeBorder: 'border-orange-400' };
  }
  if (name.includes('dulce') || name.includes('postre') || name.includes('torta') || name.includes('alfajor') || name.includes('pastel')) {
    return { emoji: '🍰', activeBg: 'bg-pink-100', activeBorder: 'border-pink-400' };
  }
  if (name.includes('gluten') || name.includes('sintacc') || name.includes('celiaco') || name.includes('tacc')) {
    return { emoji: '🌾', activeBg: 'bg-emerald-100', activeBorder: 'border-emerald-400' };
  }
  if (name.includes('bowl') || name.includes('ensalada') || name.includes('vegano') || name.includes('vegetariano') || name.includes('yogur')) {
    return { emoji: '🥗', activeBg: 'bg-green-100', activeBorder: 'border-green-400' };
  }
  if (name.includes('kiosco') || name.includes('golosina') || name.includes('snack')) {
    return { emoji: '🏪', activeBg: 'bg-purple-100', activeBorder: 'border-purple-400' };
  }
  if (name.includes('carne') || name.includes('pollo')) {
    return { emoji: '🍗', activeBg: 'bg-red-100', activeBorder: 'border-red-400' };
  }
  if (name.includes('pescado') || name.includes('marisco')) {
    return { emoji: '🍤', activeBg: 'bg-cyan-100', activeBorder: 'border-cyan-400' };
  }
  if (name.includes('pasta') || name.includes('fideo') || name.includes('pizza')) {
    return { emoji: '🍝', activeBg: 'bg-yellow-100', activeBorder: 'border-yellow-400' };
  }

  const fallbackEmojis = ['🍕', '🍔', '🍟', '🌭', '🍿', '🧇', '🥞', '🥐', '🥨', '🌮', '🌯', '🧀', '🍗', '🍜', '🥟', '🍩', '🍪', '🍫', '🍬', '🧉', '🍹', '🍺', '🧊', '🍇', '🍉', '🍓'];
  const colors = [
    { activeBg: 'bg-red-100', activeBorder: 'border-red-400' },
    { activeBg: 'bg-teal-100', activeBorder: 'border-teal-400' },
    { activeBg: 'bg-indigo-100', activeBorder: 'border-indigo-400' },
    { activeBg: 'bg-cyan-100', activeBorder: 'border-cyan-400' },
    { activeBg: 'bg-rose-100', activeBorder: 'border-rose-400' },
    { activeBg: 'bg-fuchsia-100', activeBorder: 'border-fuchsia-400' },
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const emojiFallback = fallbackEmojis[hash % fallbackEmojis.length];
  const colorSet = colors[hash % colors.length];

  return { 
    emoji: emojiFallback, 
    activeBg: colorSet.activeBg, 
    activeBorder: colorSet.activeBorder 
  };
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
  }
  return dateStr;
}

