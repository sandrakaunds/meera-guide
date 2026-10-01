

import { MODEL, reply } from '../lib/gemini.mjs';

export default async () => reply(200, { ok: true, model: MODEL });