import { STEP, type GameMode } from '../modes/GameMode';
import { PunchingBagMode, type SandbagVariant } from '../modes/PunchingBagMode';
import { SparringMode } from '../modes/SparringMode';
import { AIController, type Difficulty } from './AIController';
import type { Intent, ModeKind } from './GameState';

export type Screen = 'select' | 'play';

/** Edge-triggered parts of an Intent. */
const PRESS_KEYS = ['jump', 'punch', 'kick', 'dodge'] as const;

function noPresses(): Record<(typeof PRESS_KEYS)[number], boolean> {
  return { jump: false, punch: false, kick: false, dodge: false };
}

/** Longer frames (e.g. after the window was hidden) are cut to this, so nobody teleports. */
export const MAX_FRAME_TIME = 0.1;

/**
 * Owns the current screen and mode. Entering a mode always builds it fresh, so nothing carries
 * over between modes. Runs the mode in fixed steps and stops time entirely while paused.
 */
export class GameModeManager {
  screen: Screen = 'select';
  mode: GameMode | null = null;
  paused = false;
  difficulty: Difficulty = 'normal';
  private accumulator = 0;
  /** Key presses that arrived on a frame too short for a step; applied on the next step. */
  private pending = noPresses();

  constructor(private readonly rng: () => number = Math.random) {}

  enter(kind: ModeKind, variant: SandbagVariant = 'free'): GameMode {
    this.mode = kind === 'sparring' ? new SparringMode(new AIController(this.difficulty, this.rng)) : new PunchingBagMode(variant);
    this.screen = 'play';
    this.resetClock();
    return this.mode;
  }

  exitToSelect(): void {
    this.mode = null;
    this.screen = 'select';
    this.resetClock();
  }

  restart(): void {
    this.mode?.restart();
    this.resetClock();
  }

  setDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty;
    if (this.mode instanceof SparringMode) this.mode.ai.difficulty = difficulty;
  }

  /** Returns the number of fixed steps run. */
  update(dt: number, intent: Intent): number {
    const mode = this.mode;
    if (!mode || this.paused) return 0;
    for (const key of PRESS_KEYS) this.pending[key] ||= intent[key];

    this.accumulator += Math.min(Math.max(dt, 0), MAX_FRAME_TIME);
    let steps = 0;
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP;
      mode.step(STEP, { ...intent, ...this.pending });
      this.pending = noPresses();
      steps++;
    }
    return steps;
  }

  private resetClock(): void {
    this.paused = false;
    this.accumulator = 0;
    this.pending = noPresses();
  }
}
