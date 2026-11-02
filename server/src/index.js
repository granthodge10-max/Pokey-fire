import express from 'express';
import cors from 'cors';
import { identifyConfigured, identifyProvider, matchReading, readCard } from './identify.js';
import { getCard, searchCards } from './tcgdex.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '12mb' }));

const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, identify: identifyConfigured(), provider: identifyProvider() });
});

// Body: { image: "<base64 or data: URL>", mediaType?: "image/jpeg" }
app.post('/api/identify', async (req, res) => {
  if (!identifyConfigured()) {
    return res.status(503).json({ error: 'Card recognition is not configured on the server (set XAI_API_KEY in server/.env).' });
  }
  let { image, mediaType = 'image/jpeg' } = req.body || {};
  if (typeof image !== 'string' || !image) return res.status(400).json({ error: 'Missing image.' });
  const dataUrl = image.match(/^data:(image\/[a-z+]+);base64,(.*)$/s);
  if (dataUrl) [, mediaType, image] = dataUrl;
  if (!MEDIA_TYPES.has(mediaType)) return res.status(400).json({ error: `Unsupported image type ${mediaType}.` });
  try {
    const reading = await readCard(image, mediaType);
    const matches = await matchReading(reading);
    res.json({ reading, matches });
  } catch (err) {
    console.error('identify failed', err);
    res.status(502).json({ error: err.message || 'Identification failed.' });
  }
});

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ results: [] });
  // Accept "charizard 4", "charizard ex 199/165" or just a name.
  const m = q.match(/^(.*?)\s+#?([a-z]*\d+[a-z]*)(?:\/(\d+))?$/i);
  const name = m ? m[1] : q;
  const number = m ? m[2] : undefined;
  const total = m?.[3] ? Number(m[3]) : null;
  try {
    let results = await searchCards({ name, number });
    if (!results.length && number) results = await searchCards({ name: q });
    // "Bulbasaur 1/165": cards from a 165-card set are almost certainly the one meant.
    if (total) results.sort((a, b) => (b.setTotal === total) - (a.setTotal === total));
    res.json({ results });
  } catch (err) {
    console.error('search failed', err);
    res.status(502).json({ error: 'Card search is unavailable right now.' });
  }
});

app.get('/api/cards/:id', async (req, res) => {
  try {
    const card = await getCard(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found.' });
    res.json({ card });
  } catch (err) {
    console.error('card lookup failed', err);
    res.status(502).json({ error: 'Card lookup is unavailable right now.' });
  }
});

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  console.log(`Pokey Fire API on http://localhost:${port} (recognition: ${identifyProvider() || 'off, set XAI_API_KEY'})`);
});
