// Lanternfall palette: one warm light set against a cold, blue-black valley.
// Every colour the game draws comes from here, so the whole scene reads as one
// piece of art direction rather than separate objects.

export const PALETTE = {
  night: 0x070a12,
  ground: 0x121826,
  groundWarm: 0x1d2233,
  ridge: 0x0b0f1a,
  stone: 0x1a2030,
  stoneLit: 0x2a3245,

  ember: 0xffb24a,
  emberHot: 0xffe2a8,
  emberDeep: 0xd9702a,
  wick: 0xfff4d6,

  moss: 0x8ed49a,
  mossDeep: 0x3f7d55,

  blood: 0xe0574f,
  moth: 0x4a4550,
  mothWing: 0x6f6577,
  mothEye: 0xff5c4d,
  brute: 0x3b3550,
  bruteWing: 0x554b6b,
  weaver: 0x44405c,
  weaverSpit: 0x9d7bd6,

  fog: 0x0a0d16,
};

// Scene-wide tint used by the HUD and DOM overlay so page and render share
// the same warm accent.
export const CSS = {
  ember: '#ffb24a',
  emberDeep: '#d9702a',
  blood: '#e0574f',
  moss: '#8ed49a',
  dim: '#a9a191',
  ink: '#f4efe4',
};

// The three colours a moth is drawn with, one set per kind. Plain objects so a moth can
// pick its tint from one lookup at spawn time.
export const MOTH_TINT = {
  darter: { body: PALETTE.moth, wing: PALETTE.mothWing },
  brute: { body: PALETTE.brute, wing: PALETTE.bruteWing },
  weaver: { body: PALETTE.weaver, wing: 0x6c6290 },
  surge: { body: 0x2a2436, wing: 0x7a4a9c },
};
