import { clean, persona, generate, fail, reply } from '../lib/gemini.mjs';

export default async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'Use POST' });

  let body;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Invalid JSON' });
  }

  const wonder = clean(body?.wonder, 80);
  const question = clean(body?.question, 500);
  const guideName = clean(body?.guideName, 30) || 'Meera';
  const current = clean(body?.current, 1200);
  if (!wonder || !question) return reply(400, { error: 'wonder and question are required' });

  const history = (Array.isArray(body?.history) ? body.history : [])
    .slice(-6)
    .filter((m) => (m?.from === 'you' || m?.from === 'guide') && clean(m.text, 1))
    .map((m) => ({ role: m.from === 'you' ? 'user' : 'model', parts: [{ text: clean(m.text, 1200) }] }));
  while (history.length && history[0].role !== 'user') history.shift();

  const system =
    persona(guideName, wonder) +
    (current ? `\nThe traveller has just been hearing this part of the tour: "${current}"` : '') +
    '\nAnswer in 2 to 4 short sentences.';

  try {
    const answer = await generate({
      system,
      contents: [...history, { role: 'user', parts: [{ text: question }] }],
    });
    return reply(200, { answer: answer || 'Sorry, I could not think of an answer. Could you ask it another way?' });
  } catch (err) {
    return fail(err);
  }
};