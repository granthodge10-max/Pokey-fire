import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'pokey-fire-v2';
const LEGACY_KEY = 'pokey-fire-demo-v1';

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Cards saved by the original prototype were typed in by hand.
function fromLegacy(old) {
  return {
    id: old.id || newId(),
    cardId: null,
    name: old.name,
    setName: old.set || '',
    number: '',
    image: old.photo || null,
    variant: null,
    variantLabel: 'Manual entry',
    quantity: 1,
    price: Number(old.raw) || 0,
    priceUpdated: null,
    addedAt: Number(old.id) || Date.now(),
    manual: true,
  };
}

export async function loadState() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const d = JSON.parse(legacy);
      return { theme: d.theme, name: d.name, priv: d.priv, items: (d.cards || []).map(fromLegacy) };
    }
  } catch {}
  return null;
}

export function saveState(state) {
  return AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

/** The variant to default to: the one the scanner suggested, else the first one with a market price. */
export function defaultVariant(card, suggestedKey) {
  const variants = card.prices?.variants || [];
  return (
    variants.find((v) => v.key === suggestedKey && v.market != null) ||
    variants.find((v) => v.market != null) ||
    variants[0] ||
    null
  );
}

export function variantPrice(card, variantKey) {
  const v = card.prices?.variants?.find((x) => x.key === variantKey);
  return v?.market ?? v?.mid ?? null;
}

export function itemFromCard(card, variantKey) {
  const v = card.prices?.variants?.find((x) => x.key === variantKey);
  return {
    id: newId(),
    cardId: card.id,
    name: card.name,
    setName: card.set?.name || '',
    setTotal: card.set?.total ?? null,
    number: card.number,
    rarity: card.rarity || null,
    image: card.imageSmall || card.image,
    variant: v?.key || null,
    variantLabel: v?.label || 'Unpriced',
    priceSource: v?.source || null,
    quantity: 1,
    price: variantPrice(card, variantKey),
    priceUpdated: card.prices?.updated || null,
    addedAt: Date.now(),
  };
}

/** Same card + same variant stacks onto the existing entry instead of duplicating it. */
export function addToCollection(items, card, variantKey) {
  const existing = items.find((i) => i.cardId === card.id && i.variant === variantKey);
  if (existing) {
    return items.map((i) => (i === existing ? { ...i, quantity: i.quantity + 1, price: variantPrice(card, variantKey) ?? i.price } : i));
  }
  return [itemFromCard(card, variantKey), ...items];
}

export const itemValue = (item) => (item.price || 0) * (item.quantity || 1);
export const totalValue = (items) => items.reduce((sum, i) => sum + itemValue(i), 0);
export const cardCount = (items) => items.reduce((sum, i) => sum + (i.quantity || 1), 0);

/** Re-fetch prices for every catalogued card, a few at a time. */
export async function refreshPrices(items, fetchCard) {
  const ids = [...new Set(items.filter((i) => i.cardId).map((i) => i.cardId))];
  const cards = new Map();
  let failed = 0;
  for (let i = 0; i < ids.length; i += 4) {
    const batch = await Promise.allSettled(ids.slice(i, i + 4).map(fetchCard));
    batch.forEach((r, j) => (r.status === 'fulfilled' && r.value ? cards.set(ids[i + j], r.value) : failed++));
  }
  const updated = items.map((item) => {
    const card = cards.get(item.cardId);
    if (!card) return item;
    const price = variantPrice(card, item.variant);
    const v = card.prices?.variants?.find((x) => x.key === item.variant);
    return { ...item, previousPrice: item.price, price: price ?? item.price, priceSource: v?.source || item.priceSource, variantLabel: v?.label || item.variantLabel, priceUpdated: card.prices?.updated || item.priceUpdated };
  });
  return { items: updated, failed };
}
