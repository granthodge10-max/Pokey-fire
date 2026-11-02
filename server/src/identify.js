// Card identification: a vision model (xAI Grok, or Claude) reads the printed
// details off the photo, then we match that reading against TCGdex to find the
// exact card and its prices.
import Anthropic from '@anthropic-ai/sdk';
import { getCard, getSets, searchCards, setIdOf, suggestVariant } from './tcgdex.js';

const XAI_MODEL = process.env.XAI_MODEL || 'grok-4.7';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';

/** Which vision provider is configured: xAI wins when both keys are set. */
export function identifyProvider() {
  if (process.env.XAI_API_KEY) return 'xai';
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return 'anthropic';
  return null;
}
export const identifyConfigured = () => identifyProvider() !== null;

let anthropic = null;
function getAnthropic() {
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

const READING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_pokemon_card', 'name', 'number', 'set_total', 'set_name', 'set_code', 'language', 'finish', 'first_edition', 'shadowless', 'confidence', 'notes'],
  properties: {
    is_pokemon_card: { type: 'boolean', description: 'False if the photo is not a Pokémon TCG card' },
    name: { type: 'string', description: 'Card name exactly as printed, including suffixes like "ex", "V", "VMAX", "GX". Empty if unreadable.' },
    number: { type: 'string', description: 'Collector number before the slash, as printed (e.g. "199" from "199/165", "TG05", "SWSH050"). Empty if unreadable.' },
    set_total: { type: 'string', description: 'Number after the slash in the collector number (e.g. "165"). Empty if none.' },
    set_name: { type: 'string', description: 'Best guess of the expansion name from the set symbol, regulation mark, era and card style. Empty if unsure.' },
    set_code: { type: 'string', description: 'Printed set abbreviation if visible near the number (e.g. "MEW", "PAL"). Empty if none.' },
    language: { type: 'string', description: 'Language of the card text, e.g. "English", "Japanese".' },
    finish: { type: 'string', enum: ['normal', 'holofoil', 'reverse-holofoil', 'unknown'], description: 'Holo artwork = holofoil; shiny pattern on the non-art area = reverse-holofoil.' },
    first_edition: { type: 'boolean', description: 'True only if the black "Edition 1" circle stamp is printed at the left edge, just below the artwork.' },
    shadowless: {
      type: 'boolean',
      description: 'Base Set (1999) only: true if the artwork box has no drop shadow along its right edge and the HP is in thin text. False for every other set.',
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    notes: { type: 'string', description: 'Anything notable: 1st Edition stamp, promo stamp, visible damage, glare that blocked text.' },
  },
};

const PROMPT = `You are identifying a Pokémon Trading Card Game card from a photo so it can be priced.
Read the card's printed details carefully. The collector number is usually in the bottom-left or bottom-right corner (e.g. "025/165"); the set symbol is near it.
Only report text you can actually read. Leave a field empty rather than guessing, except set_name where a reasoned best guess helps.`;

/** Ask the configured vision model to read the card's printed details from the image. */
export function readCard(imageBase64, mediaType) {
  return identifyProvider() === 'xai' ? readCardWithGrok(imageBase64, mediaType) : readCardWithClaude(imageBase64, mediaType);
}

async function readCardWithGrok(imageBase64, mediaType) {
  const request = {
    model: XAI_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}`, detail: 'high' } },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'card_reading', schema: READING_SCHEMA, strict: true },
    },
  };
  let res;
  try {
    res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.XAI_API_KEY}` },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') throw new Error('Card recognition took too long. Please try again.');
    throw new Error('Could not reach xAI for card recognition.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body.error?.message || body.error || body.code || `HTTP ${res.status}`;
    console.error('xAI error', res.status, JSON.stringify(body).slice(0, 500));
    throw new Error(res.status === 401 || res.status === 403 ? 'The server’s xAI API key was rejected.' : `Card recognition failed (${detail}).`);
  }
  const text = body.choices?.[0]?.message?.content;
  if (!text) throw new Error('No reading returned for this photo.');
  return JSON.parse(text);
}

async function readCardWithClaude(imageBase64, mediaType) {
  const response = await getAnthropic().beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: READING_SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  });
  if (response.stop_reason === 'refusal') {
    throw new Error('The image could not be processed. Try another photo.');
  }
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('No reading returned for this photo.');
  return JSON.parse(text);
}

const simplify = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function scoreMatch(card, reading) {
  let score = 0;
  if (simplify(card.name) === simplify(reading.name)) score += 2;
  if (reading.set_total && String(card.set.total) === String(Number(reading.set_total))) score += 3;
  const setGuess = simplify(reading.set_name);
  const setName = simplify(card.set.name);
  if (setGuess && setName) {
    if (setGuess === setName) score += 3;
    else if (setGuess.includes(setName) || setName.includes(setGuess)) score += 1.5;
  }
  if (reading.finish !== 'unknown' && card.prices.variants.some((v) => v.finish === reading.finish)) score += 0.5;
  return score;
}

/** Turn Claude's reading into ranked TCGdex matches (full card objects with prices). */
export async function matchReading(reading) {
  if (!reading.is_pokemon_card || !reading.name) return [];
  // Names like "Charizard ex" or "Pikachu V" may be indexed with different casing/spacing,
  // so fall back to the base Pokémon name when the full name finds nothing.
  const base = reading.name.split(/\s+/)[0];
  let candidates = [];
  if (reading.number) {
    candidates = await searchCards({ name: reading.name, number: reading.number, limit: 12 });
    if (!candidates.length) candidates = await searchCards({ name: base, number: reading.number, limit: 12 });
  }
  if (!candidates.length) {
    candidates = await searchCards({ name: reading.name, limit: 100 });
    // Without a number, use the set guess to pull matching sets to the front.
    if (reading.set_name || reading.set_total) {
      const sets = await getSets();
      const guess = simplify(reading.set_name);
      const likely = new Set(
        sets
          .filter((s) => (guess && simplify(s.name) === guess) || (reading.set_total && String(s.cardCount?.official) === String(Number(reading.set_total))))
          .map((s) => s.id),
      );
      candidates.sort((a, b) => likely.has(setIdOf(b.id)) - likely.has(setIdOf(a.id)));
    }
  }
  const full = (await Promise.all(candidates.slice(0, 8).map((c) => getCard(c.id)))).filter(Boolean);
  return full
    .map((card) => ({ card, score: scoreMatch(card, reading) }))
    .sort((a, b) => b.score - a.score)
    .map(({ card, score }) => ({ ...card, matchScore: score, suggestedVariant: suggestVariant(card.prices.variants, reading) }));
}
