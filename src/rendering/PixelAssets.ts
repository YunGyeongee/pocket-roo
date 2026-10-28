// All graphics are drawn in code from the small sprites and the 3x5 font below; no external assets.
// The kangaroo is split into layers (legs, torso, head, gloves) that poses move around, so a
// sprite sheet can replace these arrays later without touching the game logic.

/** PICO-8 style palette for the ring and UI. */
export const PALETTE = {
  black: '#000000',
  ink: '#1a1c2c',
  navy: '#1d2b53',
  plum: '#7e2553',
  green: '#008751',
  brown: '#ab5236',
  darkGrey: '#5f574f',
  lightGrey: '#c2c3c7',
  white: '#fff1e8',
  red: '#ff004d',
  orange: '#ffa300',
  yellow: '#ffec27',
  lime: '#00e436',
  blue: '#29adff',
  lavender: '#83769c',
  pink: '#ff77a8',
  peach: '#ffccaa',
} as const;

/** Colors behind the sprite letters. The two kangaroos differ in fur and glove color. A type (not an interface) so it works as a plain color lookup. */
export type Skin = {
  k: string; // outline
  o: string; // fur
  l: string; // light fur
  d: string; // dark fur
  c: string; // belly
  w: string; // eye shine
  g: string; // glove
  h: string; // glove highlight
  x: string; // glove shade
};

export const SKINS: Record<'left' | 'right', Skin> = {
  // A red kangaroo with red gloves, like a cross-stitch boxing kangaroo.
  left: {
    k: '#2b1509',
    o: '#c8712f',
    l: '#e8a25a',
    d: '#8a4318',
    c: '#f7e2b5',
    w: '#ffffff',
    g: '#e3263f',
    h: '#ff8f9c',
    x: '#99142b',
  },
  // A grey kangaroo with blue gloves.
  right: {
    k: '#1e1a24',
    o: '#8f8394',
    l: '#b9adbd',
    d: '#5e5466',
    c: '#efe3d3',
    w: '#ffffff',
    g: '#2f7fe0',
    h: '#9fd0ff',
    x: '#1a4a99',
  },
};

export type Sprite = readonly string[];

// Kangaroo layers, facing right. Rows may be ragged; missing cells are transparent.
// Legend: k outline, o fur, l light fur, d dark fur, c belly, w eye shine, g/h/x glove.

const HEAD: Sprite = [
  '.kk..kk',
  'kdlkkdlk',
  'kdlkkdlk',
  'kdlkkdlk',
  '.kdkkdlk',
  '.koooooookk',
  'koooooookwkk',
  'kooooooookkook',
  'koooooooooooook',
  '.koooooccccckk',
  '..kkkkkkkkkk',
];

/** Copy of `sprite` with some rows replaced, given as { rowIndex: row }. */
function withRows(sprite: Sprite, rows: Record<number, string>): Sprite {
  return sprite.map((row, index) => rows[index] ?? row);
}

export const HEADS = {
  normal: HEAD,
  blink: withRows(HEAD, { 6: 'kooooooooookk', 7: 'koooooookkkook' }),
  hurt: withRows(HEAD, { 6: 'koooooookoook', 7: 'kooooooookkook' }),
  happy: withRows(HEAD, { 6: 'kooooooookokk', 7: 'koooooookoookk' }),
  sad: withRows(HEAD, { 6: 'kooooooooookk', 7: 'koooooookkkook', 9: '.kooooocckcckk' }),
} satisfies Record<string, Sprite>;

export type HeadKey = keyof typeof HEADS;

export const TORSO: Sprite = [
  '...kooocck',
  '..koooccccck',
  '.koooocccccck',
  '.koooocccccck',
  'kooooocccccck',
  'kooooocccccck',
  'kooooocccccck',
  'kooooocccccck',
  'kooooocccccck',
  '.koooocccccck',
  '.koooooccccck',
  '.kooooooooook',
];

/** Legs and tail; the last row sits on the floor. */
export const LEGS = {
  stand: [
    '..........koooooooook',
    '.........kooooooooooook',
    '........koooooooooooook',
    '........kooooooodooook',
    '.......koooooooodkoook',
    '......koooooooodkkook',
    '....kkooooooookkdkook',
    '..kkoooookkkk..kook',
    '.koookkk......kook',
    'kookk........kooooooook',
    'kkk..........kkkkkkkkkk',
  ],
  // Leaning back on the tail with one leg thrust forward, sole first.
  kick: [
    '..........koooooooook..................kk',
    '.........kooooooooooookkkkkkkkkkkkkkkkklk',
    '........koooooooooooooooooooooooooooookok',
    '........koooooooodkkkkkkkkkkkkkkkkkkkkkok',
    '.......koooooooodk....................klk',
    '......koooooooodk.....................kk',
    '....kkoooooooook',
    '..kkoooookkkook',
    '.koookkk..kook',
    'kookk....koooooook',
    'kkk......kkkkkkkkk',
  ],
  // Sitting on the haunches with the tail along the floor: crouching, and the coil before a jump.
  sit: [
    '........kooooooook',
    '.......koooooooooook',
    '......kooooooooooooook',
    '...kkkoooooooooooooookkk',
    'kkkooooooooooooooooooooook',
    'kkkkkkkkkkkkkkkkkkkkkkkkk',
  ],
  // Crouching with the tail swung out front (drawn separately) for the tail sweep.
  tuck: [
    '........kooooooook',
    '.......koooooooooook',
    '......kooooooooooooook',
    '.....kooooooooooooookkk',
    '.....koooooooooooooooook',
    '.....kkkkkkkkkkkkkkkkkkk',
  ],
  // In the air: feet tucked under, tail streaming behind.
  air: [
    '..........koooooooook',
    '.........kooooooooooook',
    '........kooooooooooooook',
    '.......kooooooooodoooook',
    '.....kkooooooooodkooook',
    '...kkooooooooookkkoook',
    '.kkoooookk..kooooook',
    'koookk.......kkooooook',
    'kkk............kkkkkkk',
  ],
  // Tail drop kick: sitting back on the tail, both feet driven forward.
  dropkick: [
    '..........koooooooook...................kk',
    '.........kooooooooooookkkkkkkkkkkkkkkkkklk',
    '........kooooooooooooooooooooooooooooookok',
    '........koooooooodkkkkkkkkkkkkkkkkkkkkkkok',
    '.......koooooooodkkkkkkkkkkkkkkkkkkkkkklkk',
    '......kooooooooooooooooooooooooooooooookok',
    '.....kooooooooodkkkkkkkkkkkkkkkkkkkkkkkok',
    '....kooooooookk.......................klk',
    '...kooookkkk..........................kk',
    '..kooook',
    '.kooook',
    'koook',
    'kkkk',
  ],
} satisfies Record<string, Sprite>;

export type LegsKey = keyof typeof LEGS;

/** Where each layer's top-left corner goes, relative to the feet, in the neutral stance. */
export const LAYER_OFFSETS = {
  legs: {
    stand: { x: -12, y: -11 },
    kick: { x: -14, y: -11 },
    sit: { x: -12, y: -6 },
    tuck: { x: -12, y: -6 },
    air: { x: -12, y: -9 },
    dropkick: { x: -14, y: -13 },
  },
  torso: { x: -5, y: -23 },
  head: { x: -3, y: -33 },
  /** Shoulders the arms hang from, relative to the torso offset. */
  backShoulder: { x: 5, y: 3 },
  frontShoulder: { x: 8, y: 4 },
} as const;

/** Knocked flat on the back, head toward the tail side. Drawn as one piece. */
export const BODY_DOWN: Sprite = [
  '......................kk',
  '.kk..kk..............kook',
  'kdlkkdlkkkkkkkkkkkk..kook',
  'kdlkkooooocccccccccckkoook',
  '.kooookkoocccccccccccooook',
  'koooooooooccccccccccooooook',
  'kooooooookkkkkkkkkkkkoooooookkkk',
  '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
];
export const BODY_DOWN_OFFSET = { x: -15, y: -8 } as const;

export const GLOVE: Sprite = [
  '.kkkk.',
  'khhggk',
  'kggggk',
  'kggggk',
  'kgggxk',
  '.kkkk.',
];
export const GLOVE_SIZE = 6;

/** The champion's crown, worn after winning a sparring match. */
export const CROWN: Sprite = [
  '.k...k...k.',
  'kyk.kyk.kyk',
  'kyykyyykyyk',
  'kyyyyyyyyyk',
  'kyryywyyryk',
  'kyyyyyyyyyk',
  'kkkkkkkkkkk',
];
export const CROWN_COLORS: Record<string, string> = { k: '#2b1509', y: '#ffec27', r: '#ff004d', w: '#fff1e8' };

// 3x5 bitmap font. Each glyph is 5 rows of 3 pixels.
const FONT_ROWS: Record<string, string> = {
  '0': '### #.# #.# #.# ###', '1': '.#. ##. .#. .#. ###', '2': '### ..# ### #.. ###', '3': '### ..# .## ..# ###',
  '4': '#.# #.# ### ..# ..#', '5': '### #.. ### ..# ###', '6': '### #.. ### #.# ###', '7': '### ..# ..# .#. .#.',
  '8': '### #.# ### #.# ###', '9': '### #.# ### ..# ###',
  A: '.#. #.# ### #.# #.#', B: '##. #.# ##. #.# ##.', C: '.## #.. #.. #.. .##', D: '##. #.# #.# #.# ##.',
  E: '### #.. ##. #.. ###', F: '### #.. ##. #.. #..', G: '.## #.. #.# #.# .##', H: '#.# #.# ### #.# #.#',
  I: '### .#. .#. .#. ###', J: '..# ..# ..# #.# .#.', K: '#.# #.# ##. #.# #.#', L: '#.. #.. #.. #.. ###',
  M: '#.# ### ### #.# #.#', N: '##. #.# #.# #.# #.#', O: '.#. #.# #.# #.# .#.', P: '##. #.# ##. #.. #..',
  Q: '.#. #.# #.# ##. .##', R: '##. #.# ##. #.# #.#', S: '.## #.. .#. ..# ##.', T: '### .#. .#. .#. .#.',
  U: '#.# #.# #.# #.# ###', V: '#.# #.# #.# #.# .#.', W: '#.# #.# ### ### #.#', X: '#.# #.# .#. #.# #.#',
  Y: '#.# #.# .#. .#. .#.', Z: '### ..# .#. #.. ###',
  ':': '... .#. ... .#. ...', '-': '... ... ### ... ...', '!': '.#. .#. .#. ... .#.', '.': '... ... ... ... .#.',
  '/': '..# ..# .#. #.. #..', '>': '#.. .#. ..# .#. #..', '<': '..# .#. #.. .#. ..#', '?': '##. ..# .#. ... .#.',
  ',': '... ... ... .#. #..', '+': '... .#. ### .#. ...', '%': '#.# ..# .#. #.. #.#', ' ': '... ... ... ... ...', '=': '... ### ... ### ...',
};

/** Glyph pixels as [x, y] pairs. */
export const FONT: Record<string, readonly [number, number][]> = Object.fromEntries(
  Object.entries(FONT_ROWS).map(([char, rows]) => [
    char,
    rows.split(' ').flatMap((row, y) => [...row].flatMap((cell, x) => (cell === '#' ? [[x, y] as [number, number]] : []))),
  ]),
);

export const GLYPH_WIDTH = 3;
export const GLYPH_HEIGHT = 5;
const GLYPH_SPACING = 1;

export function textWidth(text: string, scale = 1): number {
  return text.length === 0 ? 0 : (text.length * (GLYPH_WIDTH + GLYPH_SPACING) - GLYPH_SPACING) * scale;
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale = 1): void {
  ctx.fillStyle = color;
  let cursor = Math.round(x);
  const top = Math.round(y);
  for (const char of text.toUpperCase()) {
    for (const [gx, gy] of FONT[char] ?? FONT['?']) ctx.fillRect(cursor + gx * scale, top + gy * scale, scale, scale);
    cursor += (GLYPH_WIDTH + GLYPH_SPACING) * scale;
  }
}

/** Text with a 1px dark outline so it reads on any background. */
export function drawOutlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale = 1): void {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawText(ctx, text, x + dx, y + dy, PALETTE.black, scale);
  drawText(ctx, text, x, y, color, scale);
}

export function drawCenteredText(ctx: CanvasRenderingContext2D, text: string, centerX: number, y: number, color: string, scale = 1): void {
  drawOutlinedText(ctx, text, centerX - textWidth(text, scale) / 2, y, color, scale);
}

/** Pixel-exact line (Bresenham), so rotated shapes stay crisp. */
export function drawPixelLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string): void {
  ctx.fillStyle = color;
  let x = Math.round(x0);
  let y = Math.round(y0);
  const ex = Math.round(x1);
  const ey = Math.round(y1);
  const dx = Math.abs(ex - x);
  const dy = -Math.abs(ey - y);
  const sx = x < ex ? 1 : -1;
  const sy = y < ey ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x, y, 1, 1);
    if (x === ex && y === ey) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
