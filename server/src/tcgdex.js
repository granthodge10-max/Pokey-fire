// Thin client for the free TCGdex API (https://tcgdex.dev), which includes
// TCGplayer (USD) and Cardmarket (EUR) pricing on each card.

const BASE = 'https://api.tcgdex.net/v2/en';
const CACHE_MS = 30 * 60 * 1000;
const cache = new Map();

async function get(path) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const res = await fetch(BASE + path, { headers: { accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`TCGdex ${res.status} for ${path}`);
  const data = await res.json();
  cache.set(path, { at: Date.now(), data });
  return data;
}

// TCG Pocket is a digital-only game; its cards have no market value.
let pocketSetIds = null;
async function isPocketCard(id) {
  if (!pocketSetIds) {
    const serie = await get('/series/tcgp');
    pocketSetIds = new Set((serie?.sets || []).map((s) => s.id));
  }
  return pocketSetIds.has(setIdOf(id));
}

const normNumber = (n) => String(n ?? '').trim().replace(/^0+(?=\d)/, '').toLowerCase();
export const setIdOf = (cardId) => cardId.slice(0, cardId.lastIndexOf('-'));

function briefCard(c, setsById) {
  const set = setsById.get(setIdOf(c.id));
  return {
    id: c.id,
    name: c.name,
    number: c.localId,
    setName: set?.name || null,
    setTotal: set?.cardCount?.official ?? null,
    image: c.image ? `${c.image}/low.webp` : null,
  };
}

/** Search cards by name, optionally narrowed to an exact printed number. */
export async function searchCards({ name, number, limit = 30 }) {
  const params = new URLSearchParams();
  if (name) params.set('name', name);
  if (number) params.set('localId', normNumber(number));
  params.set('pagination:itemsPerPage', String(number ? 100 : limit * 2));
  const [list, sets] = await Promise.all([get(`/cards?${params}`), getSets()]);
  const setsById = new Map(sets.map((s) => [s.id, s]));
  const out = [];
  for (const c of list || []) {
    // TCGdex's localId filter is a substring match ("4" also matches "14").
    if (number && normNumber(c.localId) !== normNumber(number)) continue;
    if (await isPocketCard(c.id)) continue;
    out.push(briefCard(c, setsById));
  }
  // Exact name matches first ("Pikachu" before "Pikachu on the Ball"), then cards with images.
  const exact = (c) => (name && c.name.toLowerCase() === name.toLowerCase() ? 1 : 0);
  out.sort((a, b) => exact(b) - exact(a) || Boolean(b.image) - Boolean(a.image));
  return out.slice(0, limit);
}

const VARIANT_LABELS = {
  normal: 'Normal',
  holofoil: 'Holofoil',
  'reverse-holofoil': 'Reverse Holo',
  '1st-edition': '1st Edition',
  '1st-edition-holofoil': '1st Edition Holo',
  '1st-edition-normal': '1st Edition',
  unlimited: 'Unlimited',
  'unlimited-holofoil': 'Unlimited Holo',
};
const titleCase = (s) => s.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
const labelFor = (key) => VARIANT_LABELS[key] || titleCase(key);

// TCGplayer keys like "1st-edition-holofoil" carry the edition and finish the
// variant-picker needs; tag each variant with them.
function tagsForTcgplayerKey(key) {
  const firstEdition = key.startsWith('1st-edition');
  const rest = key.replace(/^(1st-edition|unlimited)-?/, '');
  const finish = rest === 'holofoil' || rest === 'reverse-holofoil' ? rest : 'normal';
  return { finish, firstEdition, shadowless: false, stamped: false };
}

const FINISH_BY_TYPE = { holo: 'holofoil', reverse: 'reverse-holofoil', normal: 'normal' };
const FINISH_LABELS = { holofoil: 'Holo', 'reverse-holofoil': 'Reverse Holo', normal: '' };

// Exchange rate for turning Cardmarket's EUR prices into USD, from the ECB via Frankfurter.
let fx = { rate: null, at: 0 };
export async function eurToUsdRate() {
  if (fx.rate && Date.now() - fx.at < 12 * 60 * 60 * 1000) return fx.rate;
  try {
    const res = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD');
    const rate = (await res.json())?.rates?.USD;
    if (rate) fx = { rate, at: Date.now() };
  } catch (err) {
    console.error('exchange rate lookup failed', err.message);
  }
  return fx.rate;
}

const positive = (n) => (typeof n === 'number' && n > 0 ? n : null);
const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

/**
 * Printings that TCGplayer doesn't price through TCGdex (e.g. Base Set 1st Edition and
 * Shadowless) often still have a Cardmarket price on their own product. Cardmarket does
 * not split 1st Edition from other copies of the same product, so printings sharing a
 * product become one variant, marked `firstEdition: 'mixed'`.
 */
function cardmarketOnlyVariants(detailed, mainCardmarketId, eurUsd) {
  const groups = new Map();
  for (const v of detailed || []) {
    const cm = v.pricing?.cardmarket;
    const cmId = v.thirdParty?.cardmarket;
    if (v.size && v.size !== 'standard') continue;
    if (v.pricing?.tcgplayer || !cm || !cmId || cmId === mainCardmarketId) continue;
    const eur = positive(cm.trend) ?? positive(cm.avg30) ?? positive(cm.avg);
    if (!eur) continue;
    if (!groups.has(cmId)) groups.set(cmId, { members: [], cm, eur });
    groups.get(cmId).members.push(v);
  }
  const out = [];
  for (const [cmId, { members, cm, eur }] of groups) {
    const first = members[0];
    const finish = FINISH_BY_TYPE[first.type] || 'normal';
    const subtype = first.subtype && first.subtype !== 'unlimited' ? first.subtype : null;
    const firstEds = members.filter((m) => m.stamp?.includes('1st-edition')).length;
    const firstEdition = firstEds === 0 ? false : firstEds === members.length ? true : 'mixed';
    const otherStamps = [...new Set(members.flatMap((m) => m.stamp || []).filter((s) => s !== '1st-edition'))];
    // Without a subtype or stamp there's nothing to tell the user which printing this is.
    if (!subtype && !otherStamps.length && firstEdition === false) continue;
    const parts = [
      firstEdition === true ? '1st Edition' : null,
      subtype ? titleCase(subtype) : null,
      ...otherStamps.map((s) => `${titleCase(s)} Stamp`),
      FINISH_LABELS[finish],
    ].filter(Boolean);
    const label = parts.join(' ') + (firstEdition === 'mixed' ? ' (incl. 1st Edition)' : '');
    out.push({
      key: `cm-${cmId}`,
      label,
      source: 'cardmarket',
      market: eurUsd ? round2(eur * eurUsd) : null,
      low: null,
      mid: null,
      high: null,
      cardmarket: { currency: cm.unit || 'EUR', trend: positive(cm.trend), avg30: positive(cm.avg30), low: positive(cm.low), updated: cm.updated || null },
      finish,
      firstEdition,
      shadowless: Boolean(subtype?.includes('shadowless')),
      stamped: otherStamps.length > 0,
    });
  }
  return out;
}

/** Flatten TCGdex's pricing into variants the app can render and pick between. */
export function normalizePricing(pricing, detailed, eurUsd) {
  const tcp = pricing?.tcgplayer;
  const variants = [];
  if (tcp) {
    for (const [key, v] of Object.entries(tcp)) {
      if (!v || typeof v !== 'object') continue;
      variants.push({
        key,
        label: labelFor(key),
        source: 'tcgplayer',
        market: v.marketPrice ?? null,
        low: v.lowPrice ?? null,
        mid: v.midPrice ?? null,
        high: v.highPrice ?? null,
        ...tagsForTcgplayerKey(key),
      });
    }
  }
  const mainCardmarketId = detailed?.find((v) => v.pricing?.tcgplayer)?.thirdParty?.cardmarket ?? null;
  const extra = cardmarketOnlyVariants(detailed, mainCardmarketId, eurUsd);
  // Next to Shadowless / 1st Edition printings, a plain "Holofoil" is the Unlimited print.
  if (extra.some((v) => v.shadowless || v.firstEdition)) {
    for (const v of variants) if (!v.firstEdition && !v.key.startsWith('unlimited')) v.label = `Unlimited ${FINISH_LABELS[v.finish] || ''}`.trim();
  }
  variants.push(...extra);
  const cm = pricing?.cardmarket;
  return {
    currency: 'USD',
    source: 'TCGplayer',
    updated: tcp?.updated || null,
    eurUsd: eurUsd || null,
    variants,
    cardmarket: cm
      ? { currency: cm.unit || 'EUR', trend: cm.trend ?? null, avg30: cm.avg30 ?? null, low: cm.low ?? null, updated: cm.updated || null }
      : null,
  };
}

/** Best variant for what the scanner saw on the card (edition stamp, shadowless, finish). */
export function suggestVariant(variants, reading) {
  let best = null;
  let bestScore = -Infinity;
  for (const v of variants) {
    let score = 0;
    if (reading.finish && reading.finish !== 'unknown') score += v.finish === reading.finish ? 2 : -1;
    if (reading.first_edition) score += v.firstEdition === true ? 3 : v.firstEdition === 'mixed' ? 2 : -3;
    else {
      if (v.firstEdition === true) score -= 3;
      // Every 1st Edition Base Set card is shadowless, so only check shadowless otherwise.
      score += v.shadowless === Boolean(reading.shadowless) ? 1 : -2;
    }
    if (v.stamped) score -= 2;
    if (v.market != null) score += 1;
    if (v.source === 'tcgplayer') score += 0.25;
    if (score > bestScore) [best, bestScore] = [v, score];
  }
  return best?.key ?? null;
}

export async function getCard(id) {
  const [c, eurUsd] = await Promise.all([get(`/cards/${encodeURIComponent(id)}`), eurToUsdRate()]);
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    number: c.localId,
    rarity: c.rarity || null,
    hp: c.hp ?? null,
    types: c.types || [],
    illustrator: c.illustrator || null,
    image: c.image ? `${c.image}/high.webp` : null,
    imageSmall: c.image ? `${c.image}/low.webp` : null,
    set: {
      id: c.set?.id,
      name: c.set?.name,
      total: c.set?.cardCount?.official ?? null,
      logo: c.set?.logo ? `${c.set.logo}.webp` : null,
      symbol: c.set?.symbol ? `${c.set.symbol}.webp` : null,
    },
    prices: normalizePricing(c.pricing, c.variants_detailed, eurUsd),
  };
}

export async function getSets() {
  return (await get('/sets')) || [];
}
