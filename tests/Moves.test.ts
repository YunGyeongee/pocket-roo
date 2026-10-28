import { describe, expect, it } from 'vitest';
import { GROUND_Y } from '../src/entities/Arena';
import { Fighter } from '../src/entities/Fighter';
import { ATTACKS, BALANCE } from '../src/game/CombatBalance';
import { CommandBuffer, toDirection } from '../src/game/CommandBuffer';
import { resolveExchange, type HitOutcome } from '../src/game/CombatSystem';
import type { Intent } from '../src/game/GameState';
import { STEP } from '../src/modes/GameMode';
import { PunchingBagMode } from '../src/modes/PunchingBagMode';
import { poseFor } from '../src/rendering/CharacterRenderer';
import { intent, run, runMode } from './helpers';

const free = (x: number): number => x;

/** Feeds a stick motion (one Partial<Intent> per `hold` seconds), then presses `button`. */
function motion(f: Fighter, steps: Partial<Intent>[], button: Partial<Intent>, hold = 0.05): void {
  for (const step of steps) run(f, hold, {}, step);
  run(f, STEP, button, steps.at(-1) ?? {});
}

function attackAfter(f: Fighter): string | undefined {
  return f.attack?.kind;
}

/** Steps two fighters and resolves hits each step. `aInput`/`bInput` give per-step intents. */
function exchange(a: Fighter, b: Fighter, seconds: number, aInput: (i: number) => Partial<Intent>, bInput: (i: number) => Partial<Intent> = () => ({})): HitOutcome[] {
  const outcomes: HitOutcome[] = [];
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    a.update(STEP, intent(aInput(i)), free);
    b.update(STEP, intent(bInput(i)), free);
    outcomes.push(...resolveExchange(a, b, GROUND_Y));
  }
  return outcomes;
}

const once = (input: Partial<Intent>, held: Partial<Intent> = {}) => (i: number): Partial<Intent> => (i === 0 ? { ...held, ...input } : held);

describe('command input', () => {
  it('reads down, forward as a quarter circle', () => {
    const buffer = new CommandBuffer();
    for (const d of [2, 3, 6] as const) buffer.record(d, 0.05);
    expect(buffer.quarterCircleForward()).toBe(true);
  });

  it('does not mistake walking forward with a down-forward for a quarter circle', () => {
    const buffer = new CommandBuffer();
    for (const d of [6, 3, 6] as const) buffer.record(d, 0.05);
    expect(buffer.quarterCircleForward()).toBe(false);
  });

  it('drops motions that are too slow', () => {
    const buffer = new CommandBuffer();
    buffer.record(2, 0.05);
    // Back to neutral, and wait there too long.
    buffer.record(5, 0.05);
    buffer.record(5, BALANCE.commandWindow);
    buffer.record(6, 0.05);
    expect(buffer.quarterCircleForward()).toBe(false);
  });

  it('reads directions relative to facing', () => {
    expect(toDirection({ move: 1, crouch: true }, 1)).toBe(3);
    expect(toDirection({ move: -1, crouch: true }, -1)).toBe(3);
    expect(toDirection({ move: -1, crouch: false }, 1)).toBe(4);
  });

  it('turns stick plus button into the right attack', () => {
    const cases: [Partial<Intent>[], Partial<Intent>, string][] = [
      [[{}], { punch: true }, 'punch'],
      [[{}], { kick: true }, 'kick'],
      [[{ crouch: true }], { punch: true }, 'lowJab'],
      [[{ crouch: true }], { kick: true }, 'sweep'],
      [[{ crouch: true, move: 1 }], { punch: true }, 'uppercut'],
      [[{ crouch: true }, { crouch: true, move: 1 }, { move: 1 }], { punch: true }, 'straight'],
      [[{ crouch: true }, { move: 1 }], { kick: true }, 'dropkick'],
    ];
    for (const [steps, button, expected] of cases) {
      const f = new Fighter('left', 100);
      motion(f, steps, button);
      expect(attackAfter(f), expected).toBe(expected);
    }
  });

  it('mirrors commands for the kangaroo facing left', () => {
    const f = new Fighter('right', 150);
    motion(f, [{ crouch: true }, { move: -1 }], { kick: true });
    expect(attackAfter(f)).toBe('dropkick');
  });

  it('gives a plain punch when walking forward', () => {
    const f = new Fighter('left', 100);
    motion(f, [{ move: 1 }], { punch: true }, 0.4);
    expect(attackAfter(f)).toBe('punch');
  });
});

describe('tail jump', () => {
  it('coils on the tail, springs up and lands back on its feet', () => {
    const f = new Fighter('left', 100);
    run(f, STEP, { jump: true });
    expect(f.state).toBe('jumpsquat');
    expect(f.y).toBe(0);
    let peak = 0;
    for (let t = 0; t < 1; t += STEP) {
      run(f, STEP);
      peak = Math.max(peak, f.y);
    }
    expect(peak).toBeGreaterThan(25);
    expect(f.y).toBe(0);
    expect(f.state).toBe('idle');
    expect(f.x).toBe(100);
  });

  it('carries forward momentum and ignores movement in the air', () => {
    const f = new Fighter('left', 100);
    run(f, BALANCE.jump.squat + STEP * 2, { jump: true }, { move: 1 });
    run(f, 0.2, {}, { move: -1 });
    expect(f.x).toBeGreaterThan(100);
  });

  it('allows one attack per jump, and landing ends it', () => {
    const f = new Fighter('left', 100);
    run(f, BALANCE.jump.squat + 0.1, { jump: true });
    run(f, STEP, { kick: true });
    expect(f.attack?.kind).toBe('jumpKick');
    expect(f.attackCount).toBe(1);
    run(f, 0.12, {});
    run(f, STEP, { punch: true });
    expect(f.attackCount).toBe(1);
    run(f, 1);
    expect(f.attack).toBeNull();
    expect(f.state).toBe('idle');
  });

  it('cannot jump while busy', () => {
    const f = new Fighter('left', 100);
    run(f, STEP, { kick: true });
    run(f, STEP, { jump: true });
    expect(f.state).toBe('attack');
  });
});

describe('attack heights', () => {
  it('lets a crouching fighter duck under a high punch, but not a mid kick', () => {
    const a = new Fighter('left', 100);
    const b = new Fighter('right', 120);
    expect(exchange(a, b, 0.4, once({ punch: true }), () => ({ crouch: true }))).toEqual([]);
    expect(b.health).toBe(BALANCE.maxHealth);
    const c = new Fighter('left', 100);
    const d = new Fighter('right', 120);
    expect(exchange(c, d, 0.7, once({ kick: true }), () => ({ crouch: true })).map((o) => o.result)).toEqual(['hit']);
  });

  it('needs a crouching guard to stop a low sweep, which otherwise knocks down', () => {
    const a = new Fighter('left', 100);
    const b = new Fighter('right', 125);
    exchange(a, b, 0.4, once({ kick: true, crouch: true }), () => ({ guard: true }));
    expect(b.state).toBe('knockdown');
    expect(b.health).toBe(BALANCE.maxHealth - ATTACKS.sweep.damage);

    const c = new Fighter('left', 100);
    const d = new Fighter('right', 125);
    const outcomes = exchange(c, d, 0.4, once({ kick: true, crouch: true }), () => ({ guard: true, crouch: true }));
    expect(outcomes.map((o) => o.result)).toEqual(['guarded']);
    expect(d.state).toBe('guard');
  });

  it('jumps over a low sweep', () => {
    const a = new Fighter('left', 100);
    const b = new Fighter('right', 125);
    // b jumps first, a sweeps while b is in the air.
    run(b, BALANCE.jump.squat + 0.05, { jump: true });
    expect(exchange(a, b, 0.35, once({ kick: true, crouch: true }))).toEqual([]);
  });

  it('needs a standing guard to stop a jump attack', () => {
    for (const [crouch, expected] of [[false, 'guarded'], [true, 'hit']] as const) {
      const a = new Fighter('left', 100);
      const b = new Fighter('right', 118);
      run(a, BALANCE.jump.squat + 0.2, { jump: true });
      const outcomes = exchange(a, b, 0.6, once({ kick: true }), () => ({ guard: true, crouch }));
      expect(outcomes.map((o) => o.result)).toEqual([expected]);
    }
  });
});

describe('knockdowns and specials', () => {
  it('lies down after a knockdown, gets up invulnerable, then fights on', () => {
    const a = new Fighter('left', 100);
    const b = new Fighter('right', 125);
    exchange(a, b, 0.35, once({ kick: true, crouch: true }));
    expect(b.state).toBe('knockdown');
    expect(b.canAct).toBe(false);
    run(b, BALANCE.knockdownTime + STEP * 2);
    expect(b.state).toBe('getup');
    expect(b.invulnerable).toBe(true);
    run(b, BALANCE.getupTime + STEP);
    expect(b.state).toBe('idle');
  });

  it('knocks a jumping fighter out of the air', () => {
    const a = new Fighter('left', 100);
    const b = new Fighter('right', 118);
    run(b, BALANCE.jump.squat + 0.05, { jump: true });
    exchange(a, b, 0.3, once({ punch: true }));
    expect(b.state).toBe('knockdown');
  });

  it('beats a jump-in with an uppercut', () => {
    const a = new Fighter('left', 100);
    const jumper = new Fighter('right', 118);
    run(jumper, BALANCE.jump.squat + 0.2, { jump: true });
    run(jumper, STEP, { kick: true });
    const outcomes = exchange(a, jumper, 0.4, once({ command: 'uppercut' }));
    expect(outcomes.find((o) => o.attacker === jumper)?.result ?? 'dodged').toBe('dodged');
    expect(a.health).toBe(BALANCE.maxHealth);
    expect(jumper.state).toBe('knockdown');
  });

  it('launches with the uppercut', () => {
    const a = new Fighter('left', 100);
    const b = new Fighter('right', 118);
    let height = 0;
    for (let i = 0; i < 40; i++) {
      exchange(a, b, STEP, once(i === 0 ? { command: 'uppercut' } : {}));
      height = Math.max(height, b.y);
    }
    expect(height).toBeGreaterThan(5);
  });

  it('lunges forward with the power straight and drop kick', () => {
    for (const kind of ['straight', 'dropkick'] as const) {
      const f = new Fighter('left', 100);
      run(f, 0.5, { command: kind });
      expect(f.x, kind).toBeGreaterThan(120);
    }
  });

  it('puts a crown on the winner', () => {
    const f = new Fighter('left', 100);
    expect(poseFor(f).crown).toBe(false);
    f.finish(true);
    expect(poseFor(f).crown).toBe(true);
  });
});

describe('sandbag with the new moves', () => {
  it('counts sweeps as kicks and uppercuts as punches', () => {
    const mode = new PunchingBagMode();
    runMode(mode, 1, { kick: true, crouch: true });
    runMode(mode, 1, { command: 'uppercut' });
    expect(mode.stats).toMatchObject({ totalHits: 2, kickHits: 1, punchHits: 1 });
    expect(mode.drainEvents().filter((e) => e.type === 'special')).toHaveLength(2);
  });

  it('lets jump attacks hit the bag', () => {
    const mode = new PunchingBagMode();
    runMode(mode, BALANCE.jump.squat + 0.2, { jump: true });
    runMode(mode, 0.8, { kick: true });
    expect(mode.stats.kickHits).toBe(1);
  });
});
