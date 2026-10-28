import type { Fighter } from '../entities/Fighter';
import type { CombatEvent, Intent, ModeKind } from '../game/GameState';

/** Fixed simulation step, so hits land the same at any frame rate. */
export const STEP = 1 / 120;

/**
 * What the two modes share. Each mode owns its own state, so switching modes never leaks
 * scores or health from one to the other.
 */
export interface GameMode {
  readonly kind: ModeKind;
  readonly player: Fighter;
  /** Advances one fixed step. */
  step(dt: number, intent: Intent): void;
  /** Starts the mode over from scratch. */
  restart(): void;
  /** True while a fight or timed run is in progress (losing focus pauses it). */
  readonly active: boolean;
  /** Events since the last call. */
  drainEvents(): CombatEvent[];
}

/** Short freeze on heavy hits. Effects keep animating; only the fight stops. */
export class Hitstop {
  remaining = 0;

  trigger(seconds: number): void {
    this.remaining = Math.max(this.remaining, seconds);
  }

  /** Returns true while frozen. */
  consume(dt: number): boolean {
    if (this.remaining <= 0) return false;
    this.remaining -= dt;
    return true;
  }
}

/** Turns a fighter's state changes into effect events: takeoffs, landings and special moves. */
export class FighterWatcher {
  private airborne = false;
  private attacks = 0;

  constructor(private readonly fighter: Fighter) {
    this.reset();
  }

  reset(): void {
    this.airborne = this.fighter.airborne;
    this.attacks = this.fighter.attackCount;
  }

  /** Call after the fighter updated. */
  watch(groundY: number, events: CombatEvent[]): void {
    const f = this.fighter;
    if (f.airborne !== this.airborne) {
      this.airborne = f.airborne;
      if (f.airborne && f.state === 'air') events.push({ type: 'jump', x: f.x, facing: f.facing });
      else if (!f.airborne) events.push({ type: 'land', x: f.x });
    }
    if (f.attackCount !== this.attacks) {
      this.attacks = f.attackCount;
      const name = f.attack?.spec.name;
      if (name) events.push({ type: 'special', name, x: f.x, y: groundY - f.y - 46 });
    }
  }
}
