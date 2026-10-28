import { GROUND_Y, WORLD_WIDTH } from '../entities/Arena';
import type { CombatEvent } from '../game/GameState';
import { drawCenteredText, PALETTE } from './PixelAssets';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

/** Impact star drawn where a hit lands. */
interface Spark {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface Popup {
  text: string;
  x: number;
  y: number;
  life: number;
  color: string;
}

const PARTICLE_GRAVITY = 160;
const POPUP_LIFE = 0.6;
const POPUP_RISE = 10;
const SHAKE = { punch: { time: 0.08, strength: 1 }, kick: { time: 0.16, strength: 2 }, knockout: { time: 0.3, strength: 2 } };

/**
 * Purely visual feedback (sparks, particles, popups, screen shake) driven by combat events.
 * It never feeds back into the game, so effects can't change who wins.
 */
export class EffectsRenderer {
  private particles: Particle[] = [];
  private sparks: Spark[] = [];
  private popups: Popup[] = [];
  private shakeTime = 0;
  private shakeStrength = 0;

  constructor(private readonly rng: () => number = Math.random) {}

  handle(event: CombatEvent): void {
    switch (event.type) {
      case 'hit':
        if (event.heavy) {
          this.spark(event.x, event.y, 4, PALETTE.yellow);
          this.burst(event.x, event.y, 10, 80, [PALETTE.yellow, PALETTE.orange, PALETTE.white]);
          this.shake(SHAKE.kick);
        } else {
          this.spark(event.x, event.y, 2, PALETTE.white);
          this.burst(event.x, event.y, 5, 50, [PALETTE.white, PALETTE.yellow]);
          this.shake(SHAKE.punch);
        }
        if (event.combo && event.combo >= 2) this.popup(`${event.combo} HITS`, event.x, event.y - 14, PALETTE.yellow);
        break;
      case 'guard':
        this.spark(event.x, event.y, 2, PALETTE.blue);
        this.burst(event.x, event.y, 4, 30, [PALETTE.blue, PALETTE.white]);
        this.popup('GUARD', event.x, event.y - 12, PALETTE.blue);
        break;
      case 'dodge':
        this.popup('MISS', event.x, event.y - 12, PALETTE.lightGrey);
        break;
      case 'knockout':
        this.burst(event.x, GROUND_Y - 6, 16, 90, [PALETTE.yellow, PALETTE.white, PALETTE.peach], true);
        this.shake(SHAKE.knockout);
        break;
      case 'special':
        this.popup(event.name, event.x, event.y, PALETTE.orange);
        break;
      case 'jump':
        // Dust kicked up where the tail pushed off.
        this.burst(event.x - event.facing * 12, GROUND_Y, 6, 45, [PALETTE.lightGrey, PALETTE.white], true);
        break;
      case 'land':
        this.burst(event.x, GROUND_Y, 4, 30, [PALETTE.lightGrey], true);
        break;
      case 'fight':
      case 'timeup':
        break;
    }
  }

  update(dt: number): void {
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += PARTICLE_GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0 && p.y < GROUND_Y + 4);
    for (const spark of this.sparks) spark.life -= dt;
    this.sparks = this.sparks.filter((spark) => spark.life > 0);
    for (const popup of this.popups) popup.life -= dt;
    this.popups = this.popups.filter((popup) => popup.life > 0);
  }

  get shakeOffset(): { x: number; y: number } {
    if (this.shakeTime <= 0) return { x: 0, y: 0 };
    const s = this.shakeStrength;
    return { x: Math.round((this.rng() * 2 - 1) * s), y: Math.round((this.rng() * 2 - 1) * s) };
  }

  /** Effects that belong to the scene (they shake with it). */
  draw(ctx: CanvasRenderingContext2D): void {
    for (const spark of this.sparks) drawStar(ctx, spark);
    for (const p of this.particles) {
      // Particles blink out during the last third of their life.
      if (p.life < p.maxLife / 3 && Math.floor(p.life * 30) % 2 === 0) continue;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    for (const popup of this.popups) {
      const rise = (1 - popup.life / POPUP_LIFE) * POPUP_RISE;
      drawCenteredText(ctx, popup.text, popup.x, Math.round(popup.y - rise), popup.color);
    }
  }

  clear(): void {
    this.particles = [];
    this.sparks = [];
    this.popups = [];
    this.shakeTime = 0;
  }

  private shake({ time, strength }: { time: number; strength: number }): void {
    this.shakeStrength = this.shakeTime > 0 ? Math.max(this.shakeStrength, strength) : strength;
    this.shakeTime = Math.max(this.shakeTime, time);
  }

  private spark(x: number, y: number, size: number, color: string): void {
    const life = 0.1 + size * 0.025;
    this.sparks.push({ x: Math.round(x), y: Math.round(y), life, maxLife: life, size, color });
  }

  private burst(x: number, y: number, count: number, speed: number, colors: readonly string[], upwardOnly = false): void {
    for (let i = 0; i < count; i++) {
      const angle = upwardOnly ? -Math.PI * this.rng() : this.rng() * Math.PI * 2;
      const velocity = speed * (0.4 + this.rng() * 0.6);
      const life = 0.25 + this.rng() * 0.3;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life,
        maxLife: life,
        color: colors[Math.floor(this.rng() * colors.length)],
      });
    }
  }

  private popup(text: string, x: number, y: number, color: string): void {
    // Keep popups on screen near the ropes.
    this.popups.push({ text, x: Math.max(16, Math.min(WORLD_WIDTH - 16, x)), y, life: POPUP_LIFE, color });
  }
}

/** A pixel star: a plus with shorter diagonals, growing for a moment then shrinking. */
function drawStar(ctx: CanvasRenderingContext2D, spark: Spark): void {
  const t = 1 - spark.life / spark.maxLife;
  const size = Math.max(1, Math.round(spark.size * (t < 0.4 ? 0.6 + t : 1.4 - t)));
  ctx.fillStyle = PALETTE.white;
  ctx.fillRect(spark.x - size, spark.y, size * 2 + 1, 1);
  ctx.fillRect(spark.x, spark.y - size, 1, size * 2 + 1);
  ctx.fillStyle = spark.color;
  const diagonal = Math.max(1, Math.floor(size / 2));
  for (let i = 1; i <= diagonal; i++) {
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) ctx.fillRect(spark.x + dx * i, spark.y + dy * i, 1, 1);
  }
  ctx.fillRect(spark.x - 1, spark.y - 1, 3, 3);
  ctx.fillStyle = PALETTE.white;
  ctx.fillRect(spark.x, spark.y, 1, 1);
}
