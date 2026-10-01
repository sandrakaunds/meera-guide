export const WONDERS = [
  { id: 'great-wall', name: 'Great Wall of China', place: 'China', accent: '#c0502d', sky: ['#f6d9b0', '#e9a77a'], photos: 1 },
  { id: 'petra', name: 'Petra', place: 'Jordan', accent: '#b5533c', sky: ['#f7cfa8', '#e08f6e'], photos: 1 },
  { id: 'christ', name: 'Christ the Redeemer', place: 'Brazil', accent: '#2f7d6d', sky: ['#bfe3df', '#7fbfb6'], photos: 1 },
  { id: 'machu-picchu', name: 'Machu Picchu', place: 'Peru', accent: '#3f7d45', sky: ['#cfe8c8', '#8fc194'], photos: 1 },
  { id: 'chichen-itza', name: 'Chichen Itza', place: 'Mexico', accent: '#8a6d1f', sky: ['#f3e3a4', '#d8b85a'], photos: 1 },
  { id: 'colosseum', name: 'Colosseum', place: 'Italy', accent: '#a0522d', sky: ['#f4d6c2', '#d99a78'], photos: 1 },
  { id: 'taj-mahal', name: 'Taj Mahal', place: 'India', accent: '#5a6fb3', sky: ['#dfe4f7', '#aab6e6'], photos: 1 },
];

// The photo for a tour stop, or null if this wonder has none yet.
export const photoFor = (wonder, stop = 0) =>
  wonder.photos ? `/wonders/${wonder.id}/${(stop % wonder.photos) + 1}.jpg` : null;