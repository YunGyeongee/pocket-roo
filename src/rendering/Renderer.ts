import { GROUND_Y, RING_LEFT, RING_RIGHT, WORLD_HEIGHT, WORLD_WIDTH } from '../entities/Arena';
import type { CombatEvent } from '../game/GameState';
import type { GameMode } from '../modes/GameMode';
import { PunchingBagMode } from '../modes/PunchingBagMode';
import { SparringMode } from '../modes/SparringMode';
import { drawFighter } from './CharacterRenderer';
import { EffectsRenderer } from './EffectsRenderer';
import { PALETTE } from './PixelAssets';
import { drawPunchingBag } from './PunchingBagRenderer';

const MIN_WHOLE_SCALE_COVERAGE = 0.85;
const MAT_TOP = GROUND_Y - 12;
const APRON_TOP = GROUND_Y + 9;
const ROPES = [
  { y: 74, color: PALETTE.red, light: PALETTE.pink },
  { y: 85, color: PALETTE.white, light: PALETTE.white },
  { y: 96, color: PALETTE.blue, light: '#9fd0ff' },
];
const POST_TOP = 68;

/**
 * Draws the game at its logical resolution into an offscreen buffer, then scales that buffer
 * up by an integer factor with smoothing off so pixels stay sharp on Retina displays.
 */
export class Renderer {
  readonly effects = new EffectsRenderer();
  private readonly ctx: CanvasRenderingContext2D;
  private readonly buffer: HTMLCanvasElement;
  private readonly bufferCtx: CanvasRenderingContext2D;
  private readonly backdrop: HTMLCanvasElement;
  private readonly structures: HTMLCanvasElement;
  /** Off: only the ring and the kangaroos are drawn, and the rest of the window stays see-through. */
  showBackground = true;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private dpr = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = get2d(canvas);
    this.buffer = createCanvas(WORLD_WIDTH, WORLD_HEIGHT);
    this.bufferCtx = get2d(this.buffer);
    this.backdrop = createCanvas(WORLD_WIDTH, WORLD_HEIGHT);
    drawBackdrop(get2d(this.backdrop));
    this.structures = createCanvas(WORLD_WIDTH, WORLD_HEIGHT);
    drawRing(get2d(this.structures));
    this.resize();
  }

  resize(): void {
    this.dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * this.dpr));
    const height = Math.max(1, Math.round(rect.height * this.dpr));
    this.canvas.width = width;
    this.canvas.height = height;
    const fit = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT);
    // Whole-number scaling keeps every pixel the same size. At display scales like 125% that
    // would leave wide empty borders, so fall back to filling the window instead.
    const whole = Math.floor(fit);
    this.scale = whole >= 1 && whole / fit >= MIN_WHOLE_SCALE_COVERAGE ? whole : fit;
    this.offsetX = Math.floor((width - WORLD_WIDTH * this.scale) / 2);
    this.offsetY = Math.floor((height - WORLD_HEIGHT * this.scale) / 2);
  }

  /** Converts a mouse position to game coordinates. */
  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * (this.canvas.width / rect.width);
    const py = (clientY - rect.top) * (this.canvas.height / rect.height);
    return { x: (px - this.offsetX) / this.scale, y: (py - this.offsetY) / this.scale };
  }

  addEvents(events: readonly CombatEvent[]): void {
    for (const event of events) this.effects.handle(event);
  }

  /** Draws the ring and, if a mode is running, its fighters; `drawOverlay` adds HUD and menus on top. */
  render(mode: GameMode | null, dt: number, drawOverlay: (ctx: CanvasRenderingContext2D) => void): void {
    // Moving the window to a display with a different pixel ratio needs a new backing size.
    if ((window.devicePixelRatio || 1) !== this.dpr) this.resize();
    this.effects.update(dt);

    const ctx = this.bufferCtx;
    const shake = this.effects.shakeOffset;
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.save();
    ctx.translate(shake.x, shake.y);
    if (this.showBackground) ctx.drawImage(this.backdrop, 0, 0);
    ctx.drawImage(this.structures, 0, 0);
    if (mode instanceof SparringMode) {
      // The fighter that's down is drawn first so the standing one is never hidden.
      const order = [mode.player, mode.cpu].sort((a, b) => Number(b.finished && b.health <= 0) - Number(a.finished && a.health <= 0));
      for (const fighter of order) drawShadow(ctx, fighter);
      for (const fighter of order) drawFighter(ctx, fighter, GROUND_Y);
    } else if (mode instanceof PunchingBagMode) {
      drawPunchingBag(ctx, mode.bag, GROUND_Y);
      drawShadow(ctx, mode.player);
      drawFighter(ctx, mode.player, GROUND_Y);
    }
    this.effects.draw(ctx);
    ctx.restore();
    drawOverlay(ctx);

    const out = this.ctx;
    out.imageSmoothingEnabled = false;
    out.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.showBackground) {
      out.fillStyle = PALETTE.ink;
      out.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    out.drawImage(this.buffer, this.offsetX, this.offsetY, WORLD_WIDTH * this.scale, WORLD_HEIGHT * this.scale);
  }
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** Shadow on the floor; it shrinks while the kangaroo is in the air. */
function drawShadow(ctx: CanvasRenderingContext2D, fighter: { x: number; y: number }): void {
  const x = Math.round(fighter.x);
  const shrink = Math.min(6, Math.round(fighter.y / 5));
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(x - 10 + shrink, GROUND_Y, 21 - shrink * 2, 1);
  ctx.fillRect(x - 7 + shrink, GROUND_Y + 1, Math.max(1, 15 - shrink * 2), 1);
}

/** The hall behind the ring: dark walls, crowd and spotlights. Left out when the background is off. */
function drawBackdrop(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Crowd: rows of dim heads behind the ring.
  for (let row = 0; row < 3; row++) {
    const y = 46 + row * 7;
    ctx.fillStyle = row === 2 ? '#2a2f4e' : PALETTE.navy;
    for (let x = (row % 2) * 4; x < WORLD_WIDTH; x += 8) {
      ctx.fillRect(x + 1, y, 4, 3);
      ctx.fillRect(x, y + 3, 6, 4);
    }
  }

  // Two spotlights aimed at the middle of the ring.
  ctx.fillStyle = 'rgba(255, 241, 232, 0.05)';
  for (const source of [70, 170]) {
    for (let y = 0; y < MAT_TOP; y++) {
      const half = 6 + y * 0.35;
      ctx.fillRect(Math.round(source - half), y, Math.round(half * 2), 1);
    }
  }
  ctx.fillStyle = PALETTE.lightGrey;
  ctx.fillRect(66, 0, 9, 2);
  ctx.fillRect(166, 0, 9, 2);
}

/** The ring itself: canvas mat, apron, corner posts and ropes. Always drawn. */
function drawRing(ctx: CanvasRenderingContext2D): void {
  // Canvas mat with a darker front edge, then the apron.
  ctx.fillStyle = '#d7d4e0';
  ctx.fillRect(0, MAT_TOP, WORLD_WIDTH, APRON_TOP - MAT_TOP);
  ctx.fillStyle = PALETTE.lightGrey;
  ctx.fillRect(0, MAT_TOP, WORLD_WIDTH, 1);
  ctx.fillRect(0, APRON_TOP - 2, WORLD_WIDTH, 2);
  ctx.fillStyle = PALETTE.lavender;
  ctx.fillRect(RING_LEFT, MAT_TOP + 1, RING_RIGHT - RING_LEFT, 1);
  ctx.fillStyle = PALETTE.plum;
  ctx.fillRect(0, APRON_TOP, WORLD_WIDTH, WORLD_HEIGHT - APRON_TOP);
  ctx.fillStyle = '#5a1a3c';
  ctx.fillRect(0, APRON_TOP, WORLD_WIDTH, 1);
  for (let x = 6; x < WORLD_WIDTH; x += 16) ctx.fillRect(x, APRON_TOP + 3, 8, 1);

  // Corner posts and ropes.
  for (const x of [RING_LEFT, RING_RIGHT]) {
    ctx.fillStyle = PALETTE.darkGrey;
    ctx.fillRect(x - 1, POST_TOP, 3, MAT_TOP - POST_TOP + 2);
    ctx.fillStyle = PALETTE.lightGrey;
    ctx.fillRect(x - 1, POST_TOP, 1, MAT_TOP - POST_TOP + 2);
    ctx.fillStyle = x === RING_LEFT ? PALETTE.red : PALETTE.blue;
    ctx.fillRect(x - 2, POST_TOP - 2, 5, 3);
  }
  for (const rope of ROPES) {
    ctx.fillStyle = rope.color;
    ctx.fillRect(RING_LEFT + 2, rope.y, RING_RIGHT - RING_LEFT - 3, 2);
    ctx.fillStyle = rope.light;
    ctx.fillRect(RING_LEFT + 2, rope.y, RING_RIGHT - RING_LEFT - 3, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(RING_LEFT + 2, rope.y + 1, RING_RIGHT - RING_LEFT - 3, 1);
  }
}
