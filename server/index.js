
import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';

const PORT = process.env.PORT || 5055;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

// Comma-separated list of frontend addresses allowed to call this server,
// e.g. https://meera-guide.vercel.app (set ALLOWED_ORIGIN on the host).
const ORIGINS = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is missing. Add it to server/.env (or the host settings).');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const app = express();

// Hosts such as Render or Railway sit behind a proxy; this makes the rate limiter see the real visitor.
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));

// CORS: only the frontends listed in ALLOWED_ORIGIN may call the API from a browser.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Protects your Gemini quota once the link is public.
app.use(
  '/api/',
  rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait a minute and try again.' },
  })
);

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const persona = (guide, wonder) =>
  `You are ${guide}, a warm, cheerful tourist guide showing a traveller around ${wonder}.
The traveller knows very little about it, so use simple everyday words and explain any special term.
Your words will be read aloud, so write plain sentences only: no markdown, no bullet points, no emojis, no headings.
Only state facts you are confident about. If you are not sure, say so honestly.
If the traveller asks about something unrelated to ${wonder}, answer in one short sentence and gently steer back to the tour.`;

// If the main model's free quota is used up (429) or the model is gone (404), try the fallback model.
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite';

async function generate({ system, contents, json = false }) {
  const models = [MODEL, FALLBACK_MODEL].filter((m, i, all) => m && all.indexOf(m) === i);
  let lastErr;
  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: system,
          temperature: 0.7,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      });
      return (res.text || '').trim();
    } catch (err) {
      lastErr = err;
      if (err?.status !== 429 && err?.status !== 404) throw err;
      console.warn(`${model} unavailable (${err.status}), trying the next model`);
    }
  }
  throw lastErr;
}

function fail(res, err) {
  console.error('Gemini error:', err?.status || '', err?.message || err);
  const status = err?.status;
  let code = 502;
  let message = 'Meera could not reach Gemini. Please try again in a moment.';
  if (status === 429) {
    code = 429;
    message = 'Gemini is busy or the free limit is reached. Try again in a minute.';
  } else if (status === 400 || status === 403) {
    message = 'Gemini rejected the request. Check the API key on the server.';
  } else if (status === 404) {
    message = 'Gemini could not find that model. Check GEMINI_MODEL on the server.';
  }
  res.status(code).json({ error: message });
}

// Finished tours are kept in memory so repeat visitors get "Start tour" instantly
// and do not use up Gemini quota. The cache is cleared whenever the server restarts.
const tourCache = new Map();
const CACHE_MAX = 50;

app.get('/api/health', (req, res) => res.json({ ok: true, model: MODEL }));

// The tour: a welcome plus 5 stops.
app.post('/api/guide', async (req, res) => {
  const wonder = clean(req.body?.wonder, 80);
  const guide = clean(req.body?.guideName, 30) || 'Meera';
  if (!wonder) return res.status(400).json({ error: 'wonder is required' });

  const key = `${guide}:${wonder}`;
  const cached = tourCache.get(key);
  if (cached) return res.json(cached);

  const prompt = `Create a virtual tour of ${wonder}.
Return JSON in exactly this shape:
{"intro": "a friendly 2 sentence welcome that names you, ${guide}, and the place",
 "scenes": [{"title": "short stop title", "narration": "2 to 3 sentences"}]}
Give exactly 5 scenes, in this order: why it is famous, who built it and when, how it was built, what to look for when standing there, and one surprising fact.`;

  try {
    const raw = await generate({ system: persona(guide, wonder), contents: prompt, json: true });
    const data = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    if (!data.intro || !Array.isArray(data.scenes) || !data.scenes.length) {
      throw new Error('Unexpected tour format from Gemini');
    }
    if (tourCache.size >= CACHE_MAX) tourCache.delete(tourCache.keys().next().value);
    tourCache.set(key, data);
    res.json(data);
  } catch (err) {
    fail(res, err);
  }
});

// A question from the traveller. Earlier messages and the current tour stop give Meera context.
app.post('/api/ask', async (req, res) => {
  const wonder = clean(req.body?.wonder, 80);
  const question = clean(req.body?.question, 500);
  const guide = clean(req.body?.guideName, 30) || 'Meera';
  const current = clean(req.body?.current, 1200);
  if (!wonder || !question) return res.status(400).json({ error: 'wonder and question are required' });

  const history = (Array.isArray(req.body?.history) ? req.body.history : [])
    .slice(-6)
    .filter((m) => (m?.from === 'you' || m?.from === 'guide') && clean(m.text, 1))
    .map((m) => ({ role: m.from === 'you' ? 'user' : 'model', parts: [{ text: clean(m.text, 1200) }] }));
  while (history.length && history[0].role !== 'user') history.shift();

  const system =
    persona(guide, wonder) +
    (current ? `\nThe traveller has just been hearing this part of the tour: "${current}"` : '') +
    '\nAnswer in 2 to 4 short sentences.';

  try {
    const answer = await generate({
      system,
      contents: [...history, { role: 'user', parts: [{ text: question }] }],
    });
    res.json({ answer: answer || 'Sorry, I could not think of an answer. Could you ask it another way?' });
  } catch (err) {
    fail(res, err);
  }
});

// Vercel runs this file as a serverless function and starts it itself, so only listen on a port locally.
if (!process.env.VERCEL) {
  app.listen(PORT, (err) => {
    // Express 5 passes startup errors (such as "port already in use") to this callback.
    if (err) {
      console.error(`Could not start on port ${PORT}: ${err.message}`);
      process.exit(1);
    }
    console.log(`Meera server on port ${PORT} using ${MODEL}`);
    console.log(ORIGINS.length ? `Allowed origins: ${ORIGINS.join(', ')}` : 'No ALLOWED_ORIGIN set (fine for local dev with the Vite proxy).');
  });
}

export default app;