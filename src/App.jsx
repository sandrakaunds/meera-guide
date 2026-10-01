

import { useEffect, useRef, useState } from 'react';
import Face from './Face.jsx';
import TourBackground from './TourBackground.jsx';
import { WONDERS, photoFor } from './wonders.js';
import { fetchTour, askGuide } from './api.js';
import { useSpeech } from './useSpeech.js';
import './App.css';

const GUIDE = 'Meera';
const SORRY = 'Sorry, I had trouble with that. Could you ask me again?';

export default function App() {
  const [wonder, setWonder] = useState(WONDERS[0]);
  const [scenes, setScenes] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chat, setChat] = useState([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const logRef = useRef(null);
  // Bumped whenever the wonder changes, so replies that arrive late for the old wonder are ignored.
  const session = useRef(0);
  // The hands-free loop keeps one answer function alive, so it reads the
  // latest wonder, stop and chat through this ref instead of stale copies.
  const live = useRef({});

  const { speak, stop, speaking, listen, listening, canListen, startChat, endChat, chatting } = useSpeech();

  const scene = scenes[index];
  const photo = photoFor(wonder, index);
  const busy = loading || asking;
  const finished = scenes.length > 0 && index === scenes.length - 1 && !speaking && !busy;
  const mood = speaking
    ? 'speaking'
    : busy
      ? 'thinking'
      : listening || chatting
        ? 'listening'
        : finished
          ? 'delighted'
          : 'idle';
  const status = listening ? 'Listening' : speaking ? 'Speaking' : busy ? 'Thinking' : chatting ? 'Listening' : 'Ready';

  live.current = { wonder, scene, chat };

  // After every message, scroll the chat box (not the whole page) to the newest one.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [chat, asking]);

  function pick(w) {
    setMenuOpen(false);
    session.current += 1;
    endChat();
    stop();
    setWonder(w);
    setScenes([]);
    setIndex(0);
    setChat([]);
    setQuestion('');
    setError('');
    setLoading(false);
    setAsking(false);
  }

  async function start() {
    const id = session.current;
    endChat();
    stop();
    setLoading(true);
    setError('');
    try {
      const result = await fetchTour(wonder.name, GUIDE);
      if (id !== session.current) return;
      if (!result?.length) throw new Error('No tour came back. Please try again.');
      setScenes(result);
      setIndex(0);
      speak(result[0].text);
    } catch (e) {
      if (id === session.current) setError(e.message);
    } finally {
      if (id === session.current) setLoading(false);
    }
  }

  function go(i) {
    if (i < 0 || i >= scenes.length) return;
    endChat();
    setIndex(i);
    speak(scenes[i].text);
  }

  // Plays or stops a piece of text. Hands-free is ended first so the mic never hears Meera's own voice.
  function toggleVoice(text) {
    endChat();
    if (speaking) stop();
    else speak(text);
  }

  // Sends a question to Meera, logs both sides, and returns her answer ('' on error).
  async function answerQuestion(q) {
    const id = session.current;
    const { wonder: w, scene: s, chat: c } = live.current;
    setChat((list) => [...list, { from: 'you', text: q }]);
    setAsking(true);
    try {
      const answer = await askGuide(w.name, q, GUIDE, { history: c.slice(-6), current: s?.text });
      if (id !== session.current) return '';
      setChat((list) => [...list, { from: 'guide', text: answer }]);
      return answer;
    } catch (e) {
      if (id !== session.current) return '';
      setChat((list) => [...list, { from: 'error', text: e.message }]);
      return '';
    } finally {
      if (id === session.current) setAsking(false);
    }
  }

  // Hands-free version: if something goes wrong, Meera says so out loud instead of staying silent.
  async function answerByVoice(q) {
    return (await answerQuestion(q)) || SORRY;
  }

  // Typed question or single push-to-talk.
  async function ask(raw) {
    const q = raw.trim();
    if (!q || asking) return;
    setQuestion('');
    const answer = await answerQuestion(q);
    if (answer) speak(answer);
  }

  const theme = { '--accent': wonder.accent, '--sky-a': wonder.sky[0], '--sky-b': wonder.sky[1] };

  return (
    <div className="app" style={theme}>
      <div className="topbar">
        <div className="topbar-row">
          <header>
            <h1>Meera Guide</h1>
            <p>Your guide to the seven wonders of the world</p>
          </header>

          {/* Hamburger button: only visible on phones and narrow windows. */}
          <button
            type="button"
            className="menu-btn"
            aria-label="Choose a wonder"
            aria-expanded={menuOpen}
            aria-controls="wonder-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="menu-current">{wonder.name}</span>
            <span className="bars" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </button>
        </div>

        <nav id="wonder-menu" className={`picker${menuOpen ? ' open' : ''}`} aria-label="The seven wonders">
          {WONDERS.map((w) => (
            <button
              key={w.id}
              className={w.id === wonder.id ? 'on' : ''}
              aria-pressed={w.id === wonder.id}
              onClick={() => pick(w)}
            >
              {w.name}
            </button>
          ))}
        </nav>
      </div>

      <main>
        <section className={`stage${photo ? ' photo' : ''}`}>
          <TourBackground src={photo} />
          <p className="place">{wonder.place}</p>
          <h2>{wonder.name}</h2>

          <div className="card" aria-live="polite">
            {scene ? (
              <>
                <h3>{scene.title}</h3>
                <p>{scene.text}</p>
                <div className="row">
                  <button onClick={() => go(index - 1)} disabled={index === 0}>Back</button>
                  <span>Stop {index + 1} of {scenes.length}</span>
                  <button onClick={() => go(index + 1)} disabled={index === scenes.length - 1}>Next</button>
                  <button className="quiet" onClick={() => toggleVoice(scene.text)}>
                    {speaking ? 'Stop voice' : 'Replay'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>
                  {error
                    ? `The tour could not load: ${error}`
                    : `Hi, I am ${GUIDE}. I will walk you through ${wonder.name}. You can stop me any time with a question.`}
                </p>
                <div className="row">
                  <button className="primary" onClick={start} disabled={loading}>
                    {loading ? `${GUIDE} is getting ready` : error ? 'Try again' : 'Start tour'}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        <aside className="guide">
          <div className={`presenter ${mood}`}>
            <Face mood={mood} size={240} />
          </div>

          <p className="name">
            {GUIDE} <span className="badge">{status}</span>
          </p>

          {canListen && (
            <button
              type="button"
              className={`talk${chatting ? ' on' : ''}`}
              onClick={() => (chatting ? endChat() : startChat(answerByVoice))}
            >
              {chatting ? 'End conversation' : 'Start conversation'}
            </button>
          )}

          <div className="log" role="log" ref={logRef}>
            {chat.length === 0 && (
              <p className="hint">Ask {GUIDE} anything about {wonder.name}, like who built it and why.</p>
            )}
            {chat.map((m, i) => (
              <p key={i} className={`msg ${m.from}`}>
                {m.text}
                {m.from === 'guide' && (
                  <button type="button" className="replay" onClick={() => toggleVoice(m.text)}>
                    {speaking ? 'Stop' : 'Replay'}
                  </button>
                )}
              </p>
            ))}
            {asking && <p className="hint">{GUIDE} is thinking</p>}
          </div>

          <form
            className="ask"
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask ${GUIDE} a question`}
              aria-label={`Ask ${GUIDE} a question`}
            />
            {canListen && (
              <button type="button" className={listening ? 'on' : ''} disabled={chatting} onClick={() => listen(ask)}>
                {listening ? 'Listening' : 'Speak'}
              </button>
            )}
            <button type="submit" className="primary" disabled={asking || !question.trim()}>Ask</button>
          </form>
        </aside>
      </main>

      <footer>
        <p>
          <span className="brand">Meera Guide</span> · Explore the seven wonders of the world
        </p>
        <p>copyrights  Beehub1 Technology created by sandra swamy kaunds</p>
        <p>© {new Date().getFullYear()} Meera Guide</p>
      </footer>
    </div>
  );
}
