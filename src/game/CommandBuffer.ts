import { BALANCE } from './CombatBalance';
import type { Facing, Intent } from './GameState';

/** Stick direction in fighting game numpad notation, relative to facing: 2 down, 6 forward, 3 down-forward, 5 neutral. */
export type Direction = 1 | 2 | 3 | 4 | 5 | 6;

interface Entry {
  direction: Direction;
  /** When this direction started. */
  time: number;
}

/** A forward press counts for a moment after it is let go, so slightly late buttons still work. */
const FORWARD_GRACE = 0.1;
const HISTORY = 1;

export function toDirection(intent: Pick<Intent, 'move' | 'crouch'>, facing: Facing): Direction {
  const forward = intent.move * facing;
  const horizontal = forward > 0.05 ? 1 : forward < -0.05 ? -1 : 0;
  if (intent.crouch) return horizontal > 0 ? 3 : horizontal < 0 ? 1 : 2;
  return horizontal > 0 ? 6 : horizontal < 0 ? 4 : 5;
}

/** Remembers recent stick directions so motions like down, forward + punch can be read. */
export class CommandBuffer {
  private history: Entry[] = [];
  private time = 0;

  record(direction: Direction, dt: number): void {
    this.time += dt;
    if (this.history.at(-1)?.direction !== direction) this.history.push({ direction, time: this.time });
    while (this.history.length > 1 && this.history[1].time < this.time - HISTORY) this.history.shift();
  }

  clear(): void {
    this.history = [];
  }

  /**
   * Down, then forward (the Street Fighter quarter circle; down-forward in between is optional).
   * Forward must be held now or have been let go just now.
   */
  quarterCircleForward(): boolean {
    const start = this.time - BALANCE.commandWindow;
    for (let i = this.history.length - 1; i >= 0; i--) {
      const entry = this.history[i];
      const end = this.history[i + 1]?.time ?? this.time;
      if (entry.direction !== 6) continue;
      if (end < this.time - FORWARD_GRACE) return false;
      // Look for a plain down before this forward, inside the window.
      for (let j = i - 1; j >= 0 && (this.history[j + 1]?.time ?? 0) >= start; j--) {
        if (this.history[j].direction === 2) return true;
      }
      return false;
    }
    return false;
  }
}
