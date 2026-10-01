

import { useEffect, useState } from 'react';

const FACES = {
  neutral: '/meera/neutral.png',
  talk: '/meera/talk.png',
  think: '/meera/think.png',
  laugh: '/meera/laugh.png',
  oh: '/meera/oh.png',
  wink: '/meera/wink.png',
};

const TALKING = ['talk', 'neutral', 'talk', 'oh', 'talk', 'neutral'];

// mood: 'idle' | 'thinking' | 'speaking' | 'delighted' | 'listening'
export default function Face({ mood = 'idle', size = 72 }) {
  const [shape, setShape] = useState('neutral');

  useEffect(() => {
    Object.values(FACES).forEach((src) => {
      new Image().src = src;
    });
  }, []);

  useEffect(() => {
    if (mood === 'speaking') {
      const id = setInterval(() => setShape(TALKING[Math.floor(Math.random() * TALKING.length)]), 150);
      return () => clearInterval(id);
    }
    if (mood === 'idle') {
      let timer;
      const scheduleWink = () => {
        timer = setTimeout(() => {
          setShape('wink');
          timer = setTimeout(() => {
            setShape('neutral');
            scheduleWink();
          }, 350);
        }, 8000 + Math.random() * 6000);
      };
      setShape('neutral');
      scheduleWink();
      return () => clearTimeout(timer);
    }
    // thinking -> think face, delighted -> laugh face, listening (and anything else) -> neutral
    setShape(mood === 'thinking' ? 'think' : mood === 'delighted' ? 'laugh' : 'neutral');
  }, [mood]);

  return (
    <img
      className="face"
      src={FACES[shape]}
      alt=""
      draggable="false"
      style={{
        width: size,
        height: size * 1.5,
        objectFit: 'cover',
        objectPosition: 'top center',
        borderRadius: 14,
      }}
    />
  );
}

