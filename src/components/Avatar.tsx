import { useEffect, useRef, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  type Appearance,
  type Bottom,
  type Headwear,
  type Top,
  SKIN_TONES,
  HAIR_COLORS,
  HAIR_STYLES,
  TOPS,
  BOTTOMS,
  SHOES,
  HEADWEAR,
} from '../data/appearance';

// Dark outline color for the colored pixel sprite (like GBC/GBA Pokémon sprites).
const OUTLINE: [number, number, number] = [0x24, 0x22, 0x2c];

/**
 * Pixelated, full-color trainer sprite. We rasterise the vector paper-doll to a
 * small grid, harden the edges, and trace a dark outline like Game Boy Color /
 * GBA Pokémon sprites — then upscale with nearest-neighbour for the chunky look.
 */
export function Avatar({ a, size = 120 }: { a: Appearance; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const svg = '<?xml version="1.0" encoding="UTF-8"?>' + renderToStaticMarkup(<AvatarSvg a={a} />);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const c = ref.current;
      if (c) {
        const gw = 48; // pixel-grid width (lower = chunkier)
        const gh = 72;
        c.width = gw;
        c.height = gh;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, gw, gh);
          ctx.imageSmoothingEnabled = true; // average colors while shrinking
          ctx.drawImage(img, 0, 0, gw, gh);
          outlineSprite(ctx, gw, gh);
        }
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [a]);

  return (
    <canvas
      ref={ref}
      className="avatar-canvas"
      style={{ width: size, height: Math.round(size * 1.5) }}
    />
  );
}

/** Harden edges and trace a dark outline, keeping full color. */
function outlineSprite(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const n = w * h;

  // Which cells are the character (vs. transparent background)?
  const isChar = new Uint8Array(n);
  for (let i = 0; i < n; i++) isChar[i] = px[i * 4 + 3] >= 128 ? 1 : 0;

  // Crisp edges: pixels are either fully opaque (keep color) or fully transparent.
  for (let i = 0; i < n; i++) px[i * 4 + 3] = isChar[i] ? 255 : 0;

  // Dark outline: any character cell touching the background.
  for (let i = 0; i < n; i++) {
    if (!isChar[i]) continue;
    const x = i % w;
    const y = (i / w) | 0;
    const edge =
      x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
      !isChar[i - 1] || !isChar[i + 1] || !isChar[i - w] || !isChar[i + w];
    if (edge) {
      const o = i * 4;
      px[o] = OUTLINE[0];
      px[o + 1] = OUTLINE[1];
      px[o + 2] = OUTLINE[2];
    }
  }

  ctx.putImageData(data, 0, 0);
}

/** The underlying vector paper-doll, rasterised by <Avatar>. */
function AvatarSvg({ a }: { a: Appearance }) {
  const skin = SKIN_TONES[a.skin]?.color ?? SKIN_TONES[0].color;
  const skinD = shade(skin, -22);
  const hair = HAIR_COLORS[a.hairColor]?.color ?? HAIR_COLORS[0].color;
  const hairD = shade(hair, -26);
  const top = TOPS[a.gender][a.top] ?? TOPS[a.gender][0];
  const bottom = BOTTOMS[a.gender][a.bottom] ?? BOTTOMS[a.gender][0];
  const shoe = (SHOES[a.gender][a.shoes] ?? SHOES[a.gender][0]).color;
  const head = HEADWEAR[a.gender][a.headwear] ?? HEADWEAR[a.gender][0];
  const styleType = (HAIR_STYLES[a.gender][a.hairStyle] ?? HAIR_STYLES[a.gender][0]).type;
  const { back, front } = renderHair(styleType, hair, hairD);
  // Chibi proportions: scale the head up around its base so it stays attached to
  // the neck while growing big (like the reference trainer sprites).
  const HEAD = 'translate(50 56) scale(1.32) translate(-50 -56)';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 150"
      width="100"
      height="150"
      shapeRendering="geometricPrecision"
    >
      {/* back hair, behind the body, scaled with the head */}
      <g transform={HEAD}>{back}</g>

      {/* small body */}
      {renderLegs(bottom, skin, skinD, shoe)}
      {renderTorso(top, skin, skinD)}
      <rect x="45" y="51" width="10" height="11" fill={skinD} />

      {/* big chibi head */}
      <g transform={HEAD}>
        <ellipse cx="30" cy="39" rx="4" ry="5" fill={skin} />
        <ellipse cx="70" cy="39" rx="4" ry="5" fill={skin} />
        <ellipse cx="50" cy="35" rx="20" ry="21.5" fill={skin} />
        <path d="M33,49 Q50,58 67,49 Q60,55 50,55 Q40,55 33,49 Z" fill={skinD} opacity="0.18" />
        {/* eyes */}
        <ellipse cx="42" cy="37" rx="3.1" ry="4.2" fill="#2b2b30" />
        <ellipse cx="58" cy="37" rx="3.1" ry="4.2" fill="#2b2b30" />
        <circle cx="40.8" cy="35.4" r="1.1" fill="#fff" />
        <circle cx="56.8" cy="35.4" r="1.1" fill="#fff" />
        {/* brows */}
        <path d="M38.5,31 Q42,29.5 45.5,31" stroke={hairD} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <path d="M54.5,31 Q58,29.5 61.5,31" stroke={hairD} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        {/* mouth + blush */}
        <path d="M46,46 Q50,49 54,46" stroke="#7a4a44" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <ellipse cx="35.5" cy="43.5" rx="3.4" ry="2.1" fill="#ff9aa0" opacity="0.5" />
        <ellipse cx="64.5" cy="43.5" rx="3.4" ry="2.1" fill="#ff9aa0" opacity="0.5" />
        {/* hair + sheen */}
        {front}
        <path d="M37,19 Q50,14 62,18" stroke={shade(hair, 46)} strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.55" />
        {renderHeadwear(head)}
      </g>
    </svg>
  );
}

// ---------- Torso + arms ----------
function renderTorso(top: Top, skin: string, skinD: string): ReactNode {
  const longSleeve = top.sleeves === 'long';
  const sleeveBottom = longSleeve ? 96 : 76;
  return (
    <g>
      {/* arms (sleeve down to elbow/wrist, then skin) */}
      <rect x="22" y="62" width="9" height={sleeveBottom - 62} rx="3" fill={top.color} />
      <rect x="69" y="62" width="9" height={sleeveBottom - 62} rx="3" fill={top.color} />
      {!longSleeve && (
        <>
          <rect x="23" y="76" width="7" height="20" rx="3" fill={skin} />
          <rect x="70" y="76" width="7" height="20" rx="3" fill={skin} />
        </>
      )}
      <circle cx="26.5" cy={longSleeve ? 97 : 97} r="4" fill={skin} />
      <circle cx="73.5" cy={longSleeve ? 97 : 97} r="4" fill={skin} />
      {/* torso */}
      <rect x="31" y="59" width="38" height="44" rx="7" fill={top.color} />
      <rect x="31" y="59" width="38" height="44" rx="7" fill="#000" opacity="0.07" />
      <rect x="31" y="59" width="38" height="44" rx="7" fill={top.color} opacity="0.93" />
      {/* collar */}
      <path d="M43,59 Q50,66 57,59" stroke={skinD} strokeWidth="2" fill="none" />
      {top.accent && <rect x="31" y="76" width="38" height="5" fill={top.accent} opacity="0.9" />}
    </g>
  );
}

// ---------- Legs / bottom / shoes ----------
function renderLegs(bottom: Bottom, skin: string, skinD: string, shoe: string): ReactNode {
  const shoes = (
    <>
      <ellipse cx="42" cy="131" rx="8" ry="4.5" fill={shoe} />
      <ellipse cx="58" cy="131" rx="8" ry="4.5" fill={shoe} />
      <ellipse cx="42" cy="131" rx="8" ry="4.5" fill="#000" opacity="0.12" />
      <ellipse cx="58" cy="131" rx="8" ry="4.5" fill={shoe} opacity="0.88" />
    </>
  );

  if (bottom.type === 'skirt') {
    return (
      <g>
        {/* legs */}
        <rect x="40" y="118" width="7" height="12" rx="3" fill={skin} />
        <rect x="53" y="118" width="7" height="12" rx="3" fill={skin} />
        {/* skirt */}
        <polygon points="33,99 67,99 76,122 24,122" fill={bottom.color} />
        <polygon points="33,99 67,99 76,122 24,122" fill={skinD} opacity="0.0" />
        {shoes}
      </g>
    );
  }

  const legBottom = bottom.type === 'shorts' ? 113 : 128;
  return (
    <g>
      {/* pants/shorts */}
      <rect x="37" y="100" width="11" height={legBottom - 100} rx="3" fill={bottom.color} />
      <rect x="52" y="100" width="11" height={legBottom - 100} rx="3" fill={bottom.color} />
      {bottom.type === 'shorts' && (
        <>
          <rect x="38" y="113" width="9" height="15" rx="3" fill={skin} />
          <rect x="53" y="113" width="9" height="15" rx="3" fill={skin} />
        </>
      )}
      {shoes}
    </g>
  );
}

// ---------- Hair ----------
const CAP =
  'M27,40 Q26,12 50,11 Q74,12 73,40 Q63,30 56,31 Q53,26 50,27 Q47,26 44,31 Q37,30 27,40 Z';

function renderHair(type: string, c: string, cd: string): { back: ReactNode; front: ReactNode } {
  const cap = <path d={CAP} fill={c} />;

  switch (type) {
    case 'buzz':
      return {
        back: null,
        front: <path d="M29,33 Q29,16 50,15 Q71,16 71,33 Q50,28 29,33 Z" fill={c} opacity="0.92" />,
      };

    case 'short':
      return { back: null, front: cap };

    case 'spiky':
      return {
        back: null,
        front: (
          <g>
            {cap}
            {[32, 41, 50, 59, 68].map((x, i) => (
              <polygon key={i} points={`${x - 4},20 ${x + 4},20 ${x},5`} fill={c} />
            ))}
          </g>
        ),
      };

    case 'messy':
      return {
        back: null,
        front: (
          <g>
            {cap}
            <path d="M27,22 L20,12 L30,20 Z" fill={c} />
            <path d="M50,15 L52,4 L57,16 Z" fill={c} />
            <path d="M73,22 L82,14 L70,21 Z" fill={c} />
          </g>
        ),
      };

    case 'bowl':
      return {
        back: null,
        front: <path d="M26,42 Q25,11 50,10 Q75,11 74,42 L74,34 Q50,29 26,34 Z" fill={c} />,
      };

    case 'mohawk':
      return {
        back: null,
        front: (
          <g>
            <path d="M33,34 Q33,22 50,21 Q67,22 67,34 Q50,30 33,34 Z" fill={cd} />
            <polygon points="45,30 55,30 53,3 47,3" fill={c} />
          </g>
        ),
      };

    case 'curly':
      return {
        back: null,
        front: (
          <g>
            {cap}
            {[30, 38, 46, 54, 62, 70].map((x, i) => (
              <circle key={i} cx={x} cy={18 + (i % 2) * 3} r="5" fill={c} />
            ))}
          </g>
        ),
      };

    case 'manbun':
      return {
        back: <circle cx="50" cy="11" r="6.5" fill={cd} />,
        front: (
          <g>
            {cap}
            <circle cx="50" cy="11" r="5" fill={c} />
          </g>
        ),
      };

    // ----- girl -----
    case 'bob':
      return {
        back: null,
        front: (
          <g>
            <path d="M24,52 Q22,12 50,11 Q78,12 76,52 L70,52 Q72,30 50,29 Q28,30 30,52 Z" fill={c} />
          </g>
        ),
      };

    case 'long':
      return {
        back: <path d="M24,30 Q24,90 30,96 L70,96 Q76,90 76,30 Q76,55 50,55 Q24,55 24,30 Z" fill={cd} />,
        front: (
          <g>
            {cap}
            <path d="M26,30 Q24,70 30,86 L36,86 Q31,60 33,32 Z" fill={c} />
            <path d="M74,30 Q76,70 70,86 L64,86 Q69,60 67,32 Z" fill={c} />
          </g>
        ),
      };

    case 'twintails':
      return {
        back: (
          <g>
            <path d="M22,34 Q10,55 16,78 L24,76 Q20,52 30,38 Z" fill={cd} />
            <path d="M78,34 Q90,55 84,78 L76,76 Q80,52 70,38 Z" fill={cd} />
          </g>
        ),
        front: (
          <g>
            {cap}
            <circle cx="24" cy="36" r="4" fill={c} />
            <circle cx="76" cy="36" r="4" fill={c} />
          </g>
        ),
      };

    case 'ponytail':
      return {
        back: <path d="M70,30 Q88,45 82,80 L74,78 Q80,50 64,38 Z" fill={cd} />,
        front: (
          <g>
            {cap}
            <circle cx="71" cy="33" r="3.5" fill={c} />
          </g>
        ),
      };

    case 'braids':
      return {
        back: null,
        front: (
          <g>
            {cap}
            {[28, 72].map((x, i) => (
              <g key={i}>
                {[40, 48, 56, 64, 72].map((y, j) => (
                  <circle key={j} cx={x} cy={y} r="3.4" fill={j % 2 ? cd : c} />
                ))}
              </g>
            ))}
          </g>
        ),
      };

    case 'wavy':
      return {
        back: (
          <path
            d="M24,32 Q22,72 28,84 Q34,78 40,86 Q46,78 52,86 Q58,78 64,86 Q70,78 72,84 Q78,72 76,32 Q76,55 50,55 Q24,55 24,32 Z"
            fill={cd}
          />
        ),
        front: cap,
      };

    case 'bun':
      return {
        back: null,
        front: (
          <g>
            {cap}
            <circle cx="50" cy="9" r="7" fill={c} />
            <circle cx="50" cy="9" r="7" fill="#000" opacity="0.08" />
          </g>
        ),
      };

    case 'pixie':
      return {
        back: null,
        front: <path d="M27,38 Q26,12 50,11 Q74,12 73,38 Q66,28 40,30 Q30,31 27,38 Z" fill={c} />,
      };

    default:
      return { back: null, front: cap };
  }
}

// ---------- Headwear ----------
function renderHeadwear(h: Headwear): ReactNode {
  const c = h.color ?? '#d83a3a';
  switch (h.type) {
    case 'cap':
      return (
        <g>
          <path d="M30,28 Q30,12 50,11 Q70,12 70,28 Z" fill={c} />
          <path d="M49,27 Q72,25 80,32 Q70,29 49,30 Z" fill={shade(c, -18)} />
          <circle cx="50" cy="12" r="2" fill={shade(c, 30)} />
        </g>
      );
    case 'beanie':
      return (
        <g>
          <path d="M28,30 Q28,9 50,9 Q72,9 72,30 Z" fill={c} />
          <rect x="28" y="28" width="44" height="5" rx="2" fill={shade(c, -18)} />
        </g>
      );
    case 'straw':
      return (
        <g>
          <ellipse cx="50" cy="28" rx="32" ry="6" fill={c} />
          <ellipse cx="50" cy="18" rx="15" ry="11" fill={c} />
          <rect x="35" y="20" width="30" height="4" fill={shade(c, -22)} />
        </g>
      );
    case 'ribbon':
      return ribbon(28, 19, c);
    case 'bow':
      return ribbon(50, 12, c);
    case 'headband':
      return (
        <g>
          <path d="M26,30 Q50,22 74,30" stroke={c} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          {ribbon(72, 26, c)}
        </g>
      );
    case 'flower':
      return (
        <g>
          {[0, 1, 2, 3, 4].map((i) => {
            const ang = (i / 5) * Math.PI * 2;
            return <circle key={i} cx={28 + Math.cos(ang) * 4} cy={20 + Math.sin(ang) * 4} r="2.6" fill={c} />;
          })}
          <circle cx="28" cy="20" r="2.4" fill="#ffe14d" />
        </g>
      );
    default:
      return null;
  }
}

function ribbon(x: number, y: number, c: string): ReactNode {
  const cd = shade(c, -18);
  return (
    <g>
      <polygon points={`${x - 9},${y - 5} ${x - 9},${y + 5} ${x},${y}`} fill={c} />
      <polygon points={`${x + 9},${y - 5} ${x + 9},${y + 5} ${x},${y}`} fill={c} />
      <polygon points={`${x - 9},${y - 5} ${x},${y} ${x - 9},${y + 5}`} fill={cd} opacity="0.25" />
      <circle cx={x} cy={y} r="2.6" fill={cd} />
    </g>
  );
}

// ---------- color helper ----------
function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h;
  const n = parseInt(full, 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(((n >> 16) & 255) + amt);
  const g = clamp(((n >> 8) & 255) + amt);
  const b = clamp((n & 255) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
