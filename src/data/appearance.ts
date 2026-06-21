// Procedural, layered trainer appearance. Every option below is just data; the
// <Avatar> component turns it into an SVG paper-doll. No image assets required,
// so this is fully self-contained and easy to extend (or swap for real pixel
// sprites later — only Avatar.tsx would change).

export type Gender = 'boy' | 'girl';

export interface Appearance {
  gender: Gender;
  skin: number;
  hairStyle: number;
  hairColor: number;
  top: number;
  bottom: number;
  shoes: number;
  headwear: number;
}

export interface Swatch {
  name: string;
  color: string;
}

// ---------- Skin (10: 5 realistic, 5 wild) ----------
export const SKIN_TONES: Swatch[] = [
  { name: 'Fair', color: '#ffe0bd' },
  { name: 'Light', color: '#f1c27d' },
  { name: 'Tan', color: '#e0ac69' },
  { name: 'Brown', color: '#c68642' },
  { name: 'Deep', color: '#8d5524' },
  { name: 'Slime Green', color: '#7ec850' },
  { name: 'Aqua', color: '#6cb4e4' },
  { name: 'Cosmic Purple', color: '#b07ae8' },
  { name: 'Ghost Gray', color: '#b8c0cc' },
  { name: 'Bubblegum', color: '#ff9ec4' },
];

// ---------- Hair colors (5) ----------
export const HAIR_COLORS: Swatch[] = [
  { name: 'Black', color: '#23242a' },
  { name: 'Brown', color: '#5a3a22' },
  { name: 'Blond', color: '#e8c25a' },
  { name: 'Red', color: '#b5482e' },
  { name: 'Silver', color: '#cfd6e0' },
];

// ---------- Hair styles (8 per gender) ----------
export interface HairStyle {
  name: string;
  type: string; // drives the SVG renderer in Avatar.tsx
}
export const HAIR_STYLES: Record<Gender, HairStyle[]> = {
  boy: [
    { name: 'Buzz', type: 'buzz' },
    { name: 'Short', type: 'short' },
    { name: 'Spiky', type: 'spiky' },
    { name: 'Messy', type: 'messy' },
    { name: 'Bowl', type: 'bowl' },
    { name: 'Mohawk', type: 'mohawk' },
    { name: 'Curly', type: 'curly' },
    { name: 'Man Bun', type: 'manbun' },
  ],
  girl: [
    { name: 'Bob', type: 'bob' },
    { name: 'Long', type: 'long' },
    { name: 'Twin Tails', type: 'twintails' },
    { name: 'Ponytail', type: 'ponytail' },
    { name: 'Braids', type: 'braids' },
    { name: 'Wavy', type: 'wavy' },
    { name: 'Top Bun', type: 'bun' },
    { name: 'Pixie', type: 'pixie' },
  ],
};

// ---------- Tops (12 per gender) ----------
export interface Top {
  name: string;
  color: string;
  sleeves: 'short' | 'long';
  accent?: string;
}
const SHIRT_PALETTE: Swatch[] = [
  { name: 'Crimson', color: '#d83a3a' },
  { name: 'Ocean', color: '#2a75bb' },
  { name: 'Forest', color: '#3fa34d' },
  { name: 'Sunflower', color: '#f2c14e' },
  { name: 'Grape', color: '#9b5de5' },
  { name: 'Rose', color: '#ff7fb0' },
  { name: 'Midnight', color: '#23242a' },
  { name: 'Cloud', color: '#e8ecf8' },
  { name: 'Ember', color: '#e0712b' },
  { name: 'Teal', color: '#17b3a3' },
  { name: 'Cocoa', color: '#7a5230' },
  { name: 'Magenta', color: '#ff5da2' },
];
function buildTops(gender: Gender): Top[] {
  const boyKinds = ['Tee', 'Jacket'];
  const girlKinds = ['Top', 'Blouse'];
  const kinds = gender === 'boy' ? boyKinds : girlKinds;
  return SHIRT_PALETTE.map((c, i) => ({
    name: `${c.name} ${kinds[i % 2]}`,
    color: c.color,
    sleeves: i % 2 === 1 ? 'long' : 'short',
    accent: i % 3 === 0 ? '#ffffff' : undefined,
  }));
}
export const TOPS: Record<Gender, Top[]> = {
  boy: buildTops('boy'),
  girl: buildTops('girl'),
};

// ---------- Bottoms (12 per gender) ----------
export interface Bottom {
  name: string;
  color: string;
  type: 'pants' | 'shorts' | 'skirt';
}
const PANT_PALETTE: Swatch[] = [
  { name: 'Indigo', color: '#3a4a8a' },
  { name: 'Charcoal', color: '#2b2f3a' },
  { name: 'Khaki', color: '#b9a66b' },
  { name: 'Berry', color: '#8a2b5a' },
  { name: 'Teal', color: '#1f7a6b' },
  { name: 'Rust', color: '#a8542a' },
];
function buildBottoms(gender: Gender): Bottom[] {
  const types: Bottom['type'][] = gender === 'boy' ? ['pants', 'shorts'] : ['skirt', 'shorts'];
  const out: Bottom[] = [];
  for (const t of types) {
    for (const c of PANT_PALETTE) {
      out.push({ name: `${c.name} ${t[0].toUpperCase()}${t.slice(1)}`, color: c.color, type: t });
    }
  }
  return out; // 2 types * 6 colors = 12
}
export const BOTTOMS: Record<Gender, Bottom[]> = {
  boy: buildBottoms('boy'),
  girl: buildBottoms('girl'),
};

// ---------- Shoes (5 per gender) ----------
const SHOE_PALETTE: Swatch[] = [
  { name: 'Red', color: '#d83a3a' },
  { name: 'Blue', color: '#2a75bb' },
  { name: 'Black', color: '#23242a' },
  { name: 'White', color: '#e8ecf8' },
  { name: 'Pink', color: '#ff7fb0' },
];
export const SHOES: Record<Gender, Swatch[]> = {
  boy: SHOE_PALETTE,
  girl: SHOE_PALETTE,
};

// ---------- Headwear (hats for boys, ribbons for girls; incl. "None") ----------
export interface Headwear {
  name: string;
  type: string;
  color?: string;
}
export const HEADWEAR: Record<Gender, Headwear[]> = {
  boy: [
    { name: 'None', type: 'none' },
    { name: 'Red Cap', type: 'cap', color: '#d83a3a' },
    { name: 'Blue Cap', type: 'cap', color: '#2a75bb' },
    { name: 'Beanie', type: 'beanie', color: '#3fa34d' },
    { name: 'Straw Hat', type: 'straw', color: '#d9b86a' },
    { name: 'Black Cap', type: 'cap', color: '#23242a' },
  ],
  girl: [
    { name: 'None', type: 'none' },
    { name: 'Red Ribbon', type: 'ribbon', color: '#d83a3a' },
    { name: 'Pink Bow', type: 'bow', color: '#ff7fb0' },
    { name: 'Headband', type: 'headband', color: '#f2c14e' },
    { name: 'Flower', type: 'flower', color: '#ff5da2' },
    { name: 'White Ribbon', type: 'ribbon', color: '#e8ecf8' },
  ],
};

export function defaultAppearance(gender: Gender = 'boy'): Appearance {
  return { gender, skin: 0, hairStyle: 0, hairColor: 0, top: 0, bottom: 0, shoes: 0, headwear: 0 };
}

export function randomAppearance(): Appearance {
  const gender: Gender = Math.random() < 0.5 ? 'boy' : 'girl';
  const r = (n: number) => Math.floor(Math.random() * n);
  return {
    gender,
    skin: r(SKIN_TONES.length),
    hairStyle: r(HAIR_STYLES[gender].length),
    hairColor: r(HAIR_COLORS.length),
    top: r(TOPS[gender].length),
    bottom: r(BOTTOMS[gender].length),
    shoes: r(SHOES[gender].length),
    headwear: r(HEADWEAR[gender].length),
  };
}

/** Keep indices in range (counts match across genders, so this mainly guards bad data). */
export function clampAppearance(a: Appearance): Appearance {
  const g = a.gender === 'girl' ? 'girl' : 'boy';
  const lim = (v: number, n: number) => Math.max(0, Math.min(n - 1, v | 0));
  return {
    gender: g,
    skin: lim(a.skin, SKIN_TONES.length),
    hairStyle: lim(a.hairStyle, HAIR_STYLES[g].length),
    hairColor: lim(a.hairColor, HAIR_COLORS.length),
    top: lim(a.top, TOPS[g].length),
    bottom: lim(a.bottom, BOTTOMS[g].length),
    shoes: lim(a.shoes, SHOES[g].length),
    headwear: lim(a.headwear, HEADWEAR[g].length),
  };
}
