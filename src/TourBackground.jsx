

import { useEffect, useState } from 'react';

// Fills its parent with a slowly moving photo. When `src` changes, the new photo fades in over the old one.
export default function TourBackground({ src }) {
  const [layers, setLayers] = useState([]);

  useEffect(() => {
    if (!src) {
      setLayers([]);
      return;
    }
    setLayers((old) => [...old.slice(-1), { src, id: (old[old.length - 1]?.id ?? 0) + 1 }]);
    const timer = setTimeout(() => setLayers((old) => old.slice(-1)), 1400);
    return () => clearTimeout(timer);
  }, [src]);

  return (
    <div className="bg" aria-hidden="true">
      {layers.map((l) => (
        <img
          key={l.id}
          className={`bg-img v${l.id % 4}`}
          src={l.src}
          alt=""
          draggable="false"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      ))}
      <div className="bg-shade" />
    </div>
  );
}