import { describe, expect, it } from 'vitest';
import { GROUND_Y } from '../src/entities/Arena';
import { Fighter } from '../src/entities/Fighter';
import { ATTACKS, BALANCE } from '../src/game/CombatBalance';
import { resolveExchange, type HitOutcome } from '../src/game/CombatSystem';
import type { AttackKind, Intent } from '../src/game/GameState';
import { STEP } from '../src/modes/GameMode';
import { intent, run } from './helpers';

/** Player on the left, opponent `distance` pixels to the right, facing each other. */
function pair(distance: number): { a: Fighter; b: Fighter } {
  const a = new Fighter('left', 100);
  const b = new Fighter('right', 100 + distance);
  return { a, b };
}

/** Steps both fighters and resolves hits each step, like SparringMode does. Returns every outcome. */
function exchange(a: Fighter, b: Fighter, seconds: number, aFirst: Partial<Intent> = {}, bHeld: Partial<Intent> = {}, bFirst: Partial<Intent> = {}): HitOutcome[] {
  const outcomes: HitOutcome[] = [];
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    a.update(STEP, intent(i === 0 ? aFirst : {}), (x) => x);
    b.update(STEP, intent(i === 0 ? { ...bHeld, ...bFirst } : bHeld), (x) => x);
    outcomes.push(...resolveExchange(a, b, GROUND_Y));
  }
  return outcomes;
}

function reach(kind: AttackKind): number {
  return ATTACKS[kind].reachEnd + BALANCE.bodyHalfWidth;
}

function attackTime(kind: AttackKind): number {
  const { startup, active, recovery } = ATTACKS[kind];
  return startup + active + recovery;
}

describe('attack range', () => {
  it('lands a punch at the edge of its reach and misses just beyond it', () => {
    const near = pair(reach('punch'));
    expect(exchange(near.a, near.b, attackTime('punch'), { punch: true }).map((o) => o.result)).toEqual(['hit']);
    const far = pair(reach('punch') + 1);
    expect(exchange(far.a, far.b, attackTime('punch'), { punch: true })).toEqual([]);
    expect(far.b.health).toBe(BALANCE.maxHealth);
  });

  it('reaches farther with a kick than with a punch', () => {
    const distance = reach('punch') + 4;
    expect(distance).toBeLessThanOrEqual(reach('kick'));
    const punch = pair(distance);
    expect(exchange(punch.a, punch.b, attackTime('punch'), { punch: true })).toEqual([]);
    const kick = pair(distance);
    const outcomes = exchange(kick.a, kick.b, attackTime('kick'), { kick: true });
    expect(outcomes.map((o) => o.result)).toEqual(['hit']);
    expect(kick.b.health).toBe(BALANCE.maxHealth - ATTACKS.kick.damage);
  });

  it('only hits what is in front', () => {
    const { a, b } = pair(10);
    a.facing = -1;
    expect(exchange(a, b, attackTime('punch'), { punch: true })).toEqual([]);
  });
});

describe('attack timing', () => {
  it('does not connect during the startup', () => {
    const { a, b } = pair(reach('kick'));
    expect(exchange(a, b, ATTACKS.kick.startup - STEP, { kick: true })).toEqual([]);
    expect(exchange(a, b, 2 * STEP).map((o) => o.result)).toEqual(['hit']);
  });

  it('lands at most once per attack', () => {
    // The defender is pinned in place so the whole active window overlaps it.
    const a = new Fighter('left', 100);
    const b = new Fighter('right', 110);
    const outcomes: HitOutcome[] = [];
    run(a, STEP, { punch: true });
    for (let t = 0; t < attackTime('punch'); t += STEP) {
      a.update(STEP, intent(), (x) => x);
      b.x = 110;
      outcomes.push(...resolveExchange(a, b, GROUND_Y));
    }
    expect(outcomes).toHaveLength(1);
    expect(b.health).toBe(BALANCE.maxHealth - ATTACKS.punch.damage);
  });

  it('ignores attack presses until the recovery ends', () => {
    const f = new Fighter('left', 100);
    run(f, STEP, { punch: true });
    expect(f.attackCount).toBe(1);
    // Mash punch and kick through the rest of the punch.
    const steps = Math.round((attackTime('punch') - STEP * 2) / STEP);
    for (let i = 0; i < steps; i++) f.update(STEP, intent({ punch: true, kick: true }), (x) => x);
    expect(f.attackCount).toBe(1);
    expect(f.state).toBe('attack');

    run(f, STEP * 3);
    expect(f.state).toBe('idle');
    run(f, STEP, { punch: true });
    expect(f.attackCount).toBe(2);
  });

  it('cannot move while attacking', () => {
    const f = new Fighter('left', 100);
    run(f, attackTime('kick') - STEP, { kick: true }, { move: 1 });
    expect(f.x).toBe(100);
  });
});

describe('guard', () => {
  it('cuts the damage of a frontal hit by the guard reduction', () => {
    const { a, b } = pair(reach('punch') - 2);
    const outcomes = exchange(a, b, attackTime('punch'), { punch: true }, { guard: true });
    expect(outcomes.map((o) => o.result)).toEqual(['guarded']);
    expect(b.health).toBeCloseTo(BALANCE.maxHealth - ATTACKS.punch.damage * (1 - BALANCE.guardReduction));
    expect(b.state).toBe('guard');
  });

  it('still lets some kick damage through and locks the guard briefly', () => {
    const { a, b } = pair(reach('kick') - 2);
    exchange(a, b, ATTACKS.kick.startup + 2 * STEP, { kick: true }, { guard: true });
    expect(b.health).toBeLessThan(BALANCE.maxHealth);
    expect(b.stun).toBeGreaterThan(0);
    expect(b.canAct).toBe(false);
  });

  it('does not block a hit from behind', () => {
    const { a, b } = pair(reach('punch') - 2);
    b.facing = 1; // turned away from the attacker
    const outcomes = exchange(a, b, attackTime('punch'), { punch: true }, { guard: true });
    expect(outcomes.map((o) => o.result)).toEqual(['hit']);
    expect(b.health).toBe(BALANCE.maxHealth - ATTACKS.punch.damage);
  });

  it('prevents attacking and slows movement', () => {
    const f = new Fighter('left', 100);
    run(f, 0.5, { punch: true, guard: true }, { guard: true, move: 1 });
    expect(f.attackCount).toBe(0);
    expect(f.state).toBe('guard');
    expect(f.x - 100).toBeCloseTo(BALANCE.moveSpeed * BALANCE.guardMoveFactor * 0.5, 0);
  });
});

describe('dodge', () => {
  it('is invulnerable only for the first part of the backstep', () => {
    const f = new Fighter('left', 120);
    run(f, STEP, { dodge: true });
    expect(f.state).toBe('dodge');
    expect(f.invulnerable).toBe(true);
    run(f, BALANCE.dodge.invulnerable);
    expect(f.invulnerable).toBe(false);
    expect(f.x).toBeLessThan(120);
  });

  it('voids an attack that lands inside the invulnerable window', () => {
    // The defender dodges just as the punch becomes active.
    const { a, b } = pair(reach('punch') - 12);
    const lead = ATTACKS.punch.startup - STEP;
    run(a, STEP, { punch: true });
    run(a, lead - STEP);
    run(b, STEP, { dodge: true });
    const outcomes = exchange(a, b, STEP * 4);
    expect(outcomes.map((o) => o.result)).toEqual(['dodged']);
    expect(b.health).toBe(BALANCE.maxHealth);
    // The dodged punch is spent and can't land later in its active window.
    expect(a.attack?.connected).toBe(true);
  });

  it('has a cooldown', () => {
    const f = new Fighter('left', 150);
    run(f, BALANCE.dodge.duration + STEP, { dodge: true });
    expect(f.state).toBe('idle');
    run(f, STEP, { dodge: true });
    expect(f.state).not.toBe('dodge');
    run(f, BALANCE.dodge.cooldown);
    run(f, STEP, { dodge: true });
    expect(f.state).toBe('dodge');
  });

  it('cannot attack while dodging', () => {
    const f = new Fighter('left', 150);
    run(f, STEP, { dodge: true });
    run(f, STEP, { punch: true });
    expect(f.attackCount).toBe(0);
  });
});

describe('hits and knockouts', () => {
  it('interrupts an attack in progress and stuns', () => {
    const { a, b } = pair(reach('punch') - 2);
    exchange(a, b, ATTACKS.punch.startup + 3 * STEP, { punch: true }, {}, { kick: true });
    expect(b.state).toBe('hit');
    expect(b.attack).toBeNull();
    expect(b.canAct).toBe(false);
  });

  it('trades when both attacks land on the same step', () => {
    const { a, b } = pair(reach('punch') - 2);
    const outcomes = exchange(a, b, attackTime('punch'), { punch: true }, {}, { punch: true });
    expect(outcomes).toHaveLength(2);
    expect(a.health).toBe(b.health);
  });

  it('knocks out at 0 health and then ignores all input', () => {
    const { a, b } = pair(reach('punch') - 2);
    b.health = ATTACKS.punch.damage;
    exchange(a, b, attackTime('punch'), { punch: true });
    expect(b.health).toBe(0);
    expect(b.state).toBe('knockout');
    const x = b.x;
    run(b, 0.5, { punch: true, dodge: true }, { move: -1, guard: true });
    expect(b.state).toBe('knockout');
    expect(b.x).toBe(x);
    expect(b.attackCount).toBe(0);
  });
});
