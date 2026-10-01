

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
  const guideName = clean(body?.guideName, 30) || 'Meera';
  if (!wonder) return reply(400, { error: 'wonder is required' });

  const prompt = `Create a virtual tour of ${wonder}.
Return JSON in exactly this shape:
{"intro": "a friendly 2 sentence welcome that names you, ${guideName}, and the place",
 "scenes": [{"title": "short stop title", "narration": "2 to 3 sentences"}]}
Give exactly 5 scenes, in this order: why it is famous, who built it and when, how it was built, what to look for when standing there, and one surprising fact.`;

  try {
    const raw = await generate({ system: persona(guideName, wonder), contents: prompt, asJson: true });
    const data = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    if (!data.intro || !Array.isArray(data.scenes) || !data.scenes.length) {
      throw new Error('Unexpected tour format from Gemini');
    }
    return reply(200, data);
  } catch (err) {
    return fail(err);
  }
};