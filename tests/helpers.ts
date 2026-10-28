import { clampToRing } from '../src/entities/Arena';
import type { Fighter } from '../src/entities/Fighter';
import { IDLE_INTENT, type Intent } from '../src/game/GameState';
import { STEP } from '../src/modes/GameMode';

export function intent(overrides: Partial<Intent> = {}): Intent {
  return { ...IDLE_INTENT, ...overrides };
}

/** Advances a fighter by `seconds` in fixed steps; `first` applies only on the first step (key presses). */
export function run(fighter: Fighter, seconds: number, first: Partial<Intent> = {}, held: Partial<Intent> = {}): void {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) fighter.update(STEP, intent(i === 0 ? { ...held, ...first } : held), clampToRing);
}

/** Runs anything with a step(dt, intent) for `seconds`. */
export function runMode(mode: { step(dt: number, intent: Intent): void }, seconds: number, first: Partial<Intent> = {}, held: Partial<Intent> = {}): void {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) mode.step(STEP, intent(i === 0 ? { ...held, ...first } : held));
}
