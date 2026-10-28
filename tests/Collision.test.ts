import { describe, expect, it } from 'vitest';
import { clampToRing, MOVE_MAX_X, MOVE_MIN_X } from '../src/entities/Arena';
import { attackSpan, bodySpan, overlaps, separate } from '../src/game/Collision';
import { ATTACKS } from '../src/game/CombatBalance';

describe('Collision', () => {
  it('puts the attack span in front of the attacker', () => {
    expect(attackSpan(100, 1, ATTACKS.punch)).toEqual({ left: 104, right: 100 + ATTACKS.punch.reachEnd });
    expect(attackSpan(100, -1, ATTACKS.punch)).toEqual({ left: 100 - ATTACKS.punch.reachEnd, right: 96 });
  });

  it('detects overlapping spans, touching edges included', () => {
    expect(overlaps({ left: 0, right: 10 }, { left: 10, right: 20 })).toBe(true);
    expect(overlaps({ left: 0, right: 10 }, { left: 10.5, right: 20 })).toBe(false);
    expect(bodySpan({ x: 50, halfWidth: 9 })).toEqual({ left: 41, right: 59 });
  });

  it('pushes overlapping bodies apart evenly', () => {
    const a = { x: 100, halfWidth: 10 };
    const b = { x: 110, halfWidth: 10 };
    expect(separate(a, b, clampToRing)).toBe(true);
    expect(b.x - a.x).toBeCloseTo(20);
    expect((a.x + b.x) / 2).toBeCloseTo(105);
  });

  it('leaves bodies that do not touch alone', () => {
    const a = { x: 100, halfWidth: 10 };
    const b = { x: 130, halfWidth: 10 };
    expect(separate(a, b, clampToRing)).toBe(false);
    expect([a.x, b.x]).toEqual([100, 130]);
  });

  it('moves only the movable body, e.g. the player against the sandbag', () => {
    const player = { x: 140, halfWidth: 10 };
    const bag = { x: 150, halfWidth: 9 };
    separate(player, bag, clampToRing, true, false);
    expect(bag.x).toBe(150);
    expect(player.x).toBe(131);
  });

  it('lets the free body give way when the other is against the ropes', () => {
    const cornered = { x: MOVE_MIN_X, halfWidth: 10 };
    const other = { x: MOVE_MIN_X + 5, halfWidth: 10 };
    separate(cornered, other, clampToRing);
    expect(cornered.x).toBe(MOVE_MIN_X);
    expect(other.x - cornered.x).toBeCloseTo(20);
  });

  it('keeps everything inside the ring', () => {
    expect(clampToRing(-50)).toBe(MOVE_MIN_X);
    expect(clampToRing(999)).toBe(MOVE_MAX_X);
  });
});
