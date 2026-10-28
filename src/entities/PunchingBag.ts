import type { Body } from '../game/Collision';
import type { Facing } from '../game/GameState';

/** Swing speed given per point of damage, in radians/s; a 6 damage jab nudges, an 18 damage drop kick sends it flying. */
const IMPULSE_PER_DAMAGE = 0.25;
const STIFFNESS = 38;
const DAMPING = 3.2;
/** The bag never tilts further than this, so it stays inside the window. */
const MAX_ANGLE = 0.55;
const FLASH_TIME = 0.12;

/**
 * Hanging sandbag. It never moves sideways and never breaks; hits only make it swing.
 * The swing is a damped spring, which keeps chained hits smooth without a physics engine.
 */
export class PunchingBag implements Body {
  readonly halfWidth = 9;
  /** Tilt in radians; positive swings the bottom to the right. */
  angle = 0;
  private velocity = 0;
  /** Counts down after a hit; the renderer flashes the bag while it's positive. */
  flash = 0;

  constructor(public x: number) {}

  hit(damage: number, attackerFacing: Facing): void {
    this.velocity += attackerFacing * damage * IMPULSE_PER_DAMAGE;
    this.flash = FLASH_TIME;
  }

  update(dt: number): void {
    this.velocity += (-STIFFNESS * this.angle - DAMPING * this.velocity) * dt;
    this.angle += this.velocity * dt;
    if (Math.abs(this.angle) > MAX_ANGLE) {
      this.angle = Math.sign(this.angle) * MAX_ANGLE;
      this.velocity *= -0.3;
    }
    this.flash = Math.max(0, this.flash - dt);
  }

  reset(): void {
    this.angle = 0;
    this.velocity = 0;
    this.flash = 0;
  }
}
