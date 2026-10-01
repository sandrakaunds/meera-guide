
// While DEMO is true, the page works with made-up text and no server.
// Keep it false to use the real Node server.
const DEMO = false;

// Locally this is empty, so calls go to /api/... and Vite's proxy forwards them to the server.
// When deployed, set VITE_API_URL on the frontend host to the backend address (no trailing slash).
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const TIMEOUT_MS = 45000; // a sleeping free-tier server can take a while to wake up

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    throw new Error(
      e.name === 'AbortError'
        ? 'Meera is taking too long to answer. Please try again.'
        : 'Meera cannot reach the server right now. Please try again in a moment.'
    );
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const text = (o, keys) => keys.map((k) => o?.[k]).find((v) => typeof v === 'string' && v.trim());

// Turns the server reply into [{ title, text }]. Adjust the key names if your server differs.
function toScenes(data) {
  const list =
    ['scenes', 'stops', 'sections', 'steps', 'tour'].map((k) => data?.[k]).find(Array.isArray) ||
    Object.values(data || {}).find(Array.isArray);
  const scenes = [];
  const intro = text(data, ['intro', 'greeting', 'welcome']);
  if (intro) scenes.push({ title: 'Welcome', text: intro });
  (list || []).forEach((item, i) => {
    if (typeof item === 'string') return scenes.push({ title: `Stop ${i + 1}`, text: item });
    const body = text(item, ['narration', 'script', 'text', 'description', 'content']);
    if (body) scenes.push({ title: text(item, ['title', 'name', 'heading']) || `Stop ${i + 1}`, text: body });
  });
  if (!scenes.length) throw new Error('The server replied, but no tour text was found.');
  return scenes;
}

export async function fetchTour(wonder, guideName) {
  if (DEMO) {
    await wait(900);
    return [
      { title: 'Welcome', text: `Hello, I am ${guideName}. Today I will take you to ${wonder}. No background needed, I will explain everything as we go.` },
      { title: 'Why it matters', text: `${wonder} is one of the most famous places on Earth. People travel from every continent just to stand in front of it.` },
      { title: 'Who built it', text: `It was built by skilled people with simple tools, over many years. That is part of what makes it so amazing.` },
      { title: 'What to look for', text: `When you visit, look closely at the small details. They tell you how people lived when it was made.` },
      { title: 'Goodbye for now', text: `That is the end of our tour. Ask me anything you like about ${wonder}, or pick another wonder above.` },
    ];
  }
  return toScenes(await post('/api/guide', { wonder, guideName }));
}

export async function askGuide(wonder, question, guideName, { history = [], current = '' } = {}) {
  if (DEMO) {
    await wait(700);
    return `Good question. In the real version, I will answer "${question}" about ${wonder} using Gemini. For now this is a practice reply.`;
  }
  const data = await post('/api/ask', { wonder, question, guideName, history, current });
  if (typeof data === 'string') return data;
  return text(data, ['answer', 'reply', 'text', 'response']) || JSON.stringify(data);
}