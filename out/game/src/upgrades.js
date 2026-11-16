// Lanternfall's upgrade catalogue: three cards offered after each cleared wave,
// drawn at random from this pool and weighted so the early waves teach the
// economy while later ones reward commitment.

export const UPGRADE_POOL = [
  { id: 'wider',   name: 'Wider beam',   blurb: 'The cone reaches further out from the wick.', tier: 'reach',   w: 3 },
  { id: 'hotter',  name: 'Hotter wick',  blurb: 'More damage a second inside the beam.',       tier: 'power',   w: 3 },
  { id: 'thrifty', name: 'Thrifty oil',  blurb: 'The burn drinks 18% less oil.',               tier: 'economy', w: 3 },
  { id: 'longwick',name: 'Long wick',    blurb: 'A taller reservoir: +30 oil, filled now.',     tier: 'economy', w: 2 },
  { id: 'swift',   name: 'Swift boots',  blurb: 'Walk 2.2 m/s faster between the stones.',     tier: 'movement',w: 2 },
  { id: 'warmth',  name: 'Extra warmth', blurb: 'One more heart before the dark wins.',        tier: 'survival',w: 1 },
];

// Weighted draw without replacement; the 'warmth' card is capped at two buys.
export function drawCards(taken, count = 3) {
  const pool = UPGRADE_POOL.filter((c) => c.id !== 'warmth' || taken.filter((t) => t === 'warmth').length < 2);
  const picked = [];
  const bag = pool.slice();
  while (picked.length < count && bag.length) {
    const total = bag.reduce((s, c) => s + c.w, 0);
    let roll = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < bag.length; i++) {
      roll -= bag[i].w;
      if (roll <= 0) { idx = i; break; }
    }
    picked.push(bag.splice(idx, 1)[0]);
  }
  return picked;
}
