

import { GoogleGenAI } from '@google/genai';

export const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

export const reply = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export const persona = (guide, wonder) =>
  `You are ${guide}, a warm, cheerful tourist guide showing a traveller around ${wonder}.
The traveller knows very little about it, so use simple everyday words and explain any special term.
Your words will be read aloud, so write plain sentences only: no markdown, no bullet points, no emojis, no headings.
Only state facts you are confident about. If you are not sure, say so honestly.
If the traveller asks about something unrelated to ${wonder}, answer in one short sentence and gently steer back to the tour.`;

export async function generate({ system, contents, asJson = false }) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: system,
      temperature: 0.7,
      ...(asJson ? { responseMimeType: 'application/json' } : {}),
    },
  });
  return (res.text || '').trim();
}

export function fail(err) {
  console.error('Gemini error:', err?.status || '', err?.message || err);
  const s = err?.status;
  const message =
    s === 429 ? 'Gemini is busy or the free limit is reached. Try again in a minute.'
    : s === 400 || s === 403 ? 'Gemini rejected the request. Check the API key.'
    : s === 404 ? 'Gemini could not find that model. Check GEMINI_MODEL.'
    : 'Meera could not reach Gemini.';
  return reply(500, { error: message });
}