

import { useCallback, useEffect, useRef, useState } from 'react';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const MAX_SILENT_TURNS = 3; // hands-free stops itself after this many silent listens in a row

function pickVoice() {
  const english = (synth?.getVoices() || []).filter((v) => v.lang.startsWith('en'));
  return (
    english.find((v) => v.lang === 'en-IN') ||
    english.find((v) => /female|zira|aria|jenny|samantha/i.test(v.name)) ||
    english[0] ||
    null
  );
}

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [thinking, setThinking] = useState(false);
  const voice = useRef(null);
  const current = useRef(null);
  const recog = useRef(null);
  const chatRef = useRef(null); // { answer, silent } while hands-free is on

  useEffect(() => {
    if (!synth) return;
    const load = () => (voice.current = pickVoice());
    load();
    synth.addEventListener('voiceschanged', load);
    return () => {
      synth.removeEventListener('voiceschanged', load);
      chatRef.current = null;
      recog.current?.abort();
      synth.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    current.current = null;
    synth?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((message, onEnd) => {
    if (!synth || !message) {
      onEnd?.();
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(message);
    if (voice.current) {
      u.voice = voice.current;
      u.lang = voice.current.lang;
    }
    u.pitch = 1.05;
    const finish = (e) => {
      if (current.current !== u) return; // cancelled or replaced: stay quiet
      current.current = null;
      setSpeaking(false);
      if (e?.error !== 'canceled' && e?.error !== 'interrupted') onEnd?.();
    };
    u.onstart = () => current.current === u && setSpeaking(true);
    u.onend = () => finish();
    u.onerror = finish;
    current.current = u;
    synth.speak(u);
  }, []);

  // One listening round. onText(text) if something was heard, otherwise onNone(errorCode).
  const recognise = useCallback((onText, onNone) => {
    const r = new Recognition();
    r.lang = 'en-IN';
    let heard = false;
    let err = '';
    r.onresult = (e) => {
      const t = e.results[0][0].transcript.trim();
      if (t && !heard) {
        heard = true;
        onText(t);
      }
    };
    r.onerror = (e) => {
      err = e.error;
    };
    r.onend = () => {
      if (recog.current === r) recog.current = null;
      setListening(false);
      if (!heard) onNone?.(err);
    };
    recog.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      recog.current = null;
      setListening(false);
      onNone?.('start-failed');
    }
  }, []);

  // Single push-to-talk (your existing Speak button).
  const listen = useCallback(
    (onResult) => {
      if (!Recognition) return;
      if (recog.current) return recog.current.stop();
      stop();
      recognise(onResult);
    },
    [recognise, stop]
  );

  const endChat = useCallback(() => {
    chatRef.current = null;
    setChatting(false);
    setThinking(false);
    recog.current?.abort();
    recog.current = null;
    setListening(false);
    stop();
  }, [stop]);

  const hear = useCallback(() => {
    const chat = chatRef.current;
    if (!chat) return;
    recognise(
      async (text) => {
        chat.silent = 0;
        setThinking(true);
        let answer = '';
        try {
          answer = await chat.answer(text);
        } catch {
          answer = '';
        }
        setThinking(false);
        if (chatRef.current !== chat) return; // ended while she was thinking
        if (answer) speak(answer, () => setTimeout(hear, 350));
        else hear();
      },
      (err) => {
        if (chatRef.current !== chat) return;
        const blocked = ['not-allowed', 'service-not-allowed', 'audio-capture'].includes(err);
        chat.silent += 1;
        if (blocked || chat.silent >= MAX_SILENT_TURNS) return endChat();
        hear();
      }
    );
  }, [recognise, speak, endChat]);

  // answer: async (questionText) => answerText. It should also add both messages to your chat log.
  const startChat = useCallback(
    (answer) => {
      if (!Recognition || chatRef.current) return;
      stop();
      chatRef.current = { answer, silent: 0 };
      setChatting(true);
      hear();
    },
    [hear, stop]
  );

  return {
    speak,
    stop,
    speaking,
    listen,
    listening,
    canListen: Boolean(Recognition),
    startChat,
    endChat,
    chatting,
    thinking,
  };
}