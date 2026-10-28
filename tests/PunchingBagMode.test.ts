import { describe, expect, it } from 'vitest';
import { ATTACKS } from '../src/game/CombatBalance';
import { BAG_X, COMBO_WINDOW, PunchingBagMode, TIME_ATTACK_SECONDS } from '../src/modes/PunchingBagMode';
import { runMode } from './helpers';

// Whole attack plus room for the hitstop freeze.
const PUNCH_TIME = ATTACKS.punch.startup + ATTACKS.punch.active + ATTACKS.punch.recovery + ATTACKS.punch.hitstop + 0.02;
const KICK_TIME = ATTACKS.kick.startup + ATTACKS.kick.active + ATTACKS.kick.recovery + ATTACKS.kick.hitstop + 0.02;

function punch(mode: PunchingBagMode): void {
  runMode(mode, PUNCH_TIME, { punch: true });
}

describe('PunchingBagMode', () => {
  it('counts punches and kicks that land', () => {
    const mode = new PunchingBagMode();
    punch(mode);
    runMode(mode, KICK_TIME, { kick: true });
    expect(mode.stats).toMatchObject({ totalHits: 2, punchHits: 1, kickHits: 1, combo: 2, bestCombo: 2 });
    expect(mode.drainEvents().filter((e) => e.type === 'hit')).toHaveLength(2);
  });

  it('scores kicks higher than punches, with a bonus for combos', () => {
    const punches = new PunchingBagMode();
    punch(punches);
    const kicks = new PunchingBagMode();
    runMode(kicks, KICK_TIME, { kick: true });
    expect(kicks.stats.score).toBeGreaterThan(punches.stats.score);

    punch(punches);
    expect(punches.stats.score).toBeGreaterThan(2 * ATTACKS.punch.score);
  });

  it('does not count attacks that miss, and a miss breaks the combo', () => {
    const mode = new PunchingBagMode();
    punch(mode);
    expect(mode.stats.combo).toBe(1);
    // Walk out of range, then swing at the air.
    runMode(mode, 1, {}, { move: -1 });
    punch(mode);
    expect(mode.stats.totalHits).toBe(1);
    expect(mode.stats.score).toBe(ATTACKS.punch.score);
    expect(mode.stats.combo).toBe(0);
    expect(mode.stats.bestCombo).toBe(1);
  });

  it('drops the combo when no hit lands for a while', () => {
    const mode = new PunchingBagMode();
    punch(mode);
    punch(mode);
    expect(mode.stats.combo).toBe(2);
    runMode(mode, COMBO_WINDOW + 0.1);
    expect(mode.stats.combo).toBe(0);
    expect(mode.stats.bestCombo).toBe(2);
  });

  it('makes the bag swing away and settle, without moving it', () => {
    const mode = new PunchingBagMode();
    let swing = 0;
    runMode(mode, ATTACKS.kick.startup, { kick: true });
    for (let i = 0; i < 60; i++) {
      runMode(mode, 0.01);
      swing = Math.max(swing, mode.bag.angle);
    }
    // Kicked from the left, the bag swings to the right.
    expect(swing).toBeGreaterThan(0.1);
    runMode(mode, 4);
    expect(Math.abs(mode.bag.angle)).toBeLessThan(0.01);
    expect(mode.bag.x).toBe(BAG_X);
  });

  it('keeps the player in front of the bag', () => {
    const mode = new PunchingBagMode();
    runMode(mode, 2, {}, { move: 1 });
    expect(mode.player.x).toBeLessThanOrEqual(BAG_X - mode.bag.halfWidth - mode.player.halfWidth + 0.001);
  });

  it('ignores the guard and dodge keys', () => {
    const mode = new PunchingBagMode();
    runMode(mode, 0.3, { dodge: true }, { guard: true });
    expect(mode.player.state).toBe('idle');
  });

  it('counts practice time up in free practice', () => {
    const mode = new PunchingBagMode();
    runMode(mode, 45);
    expect(mode.stats.time).toBeCloseTo(45, 1);
    expect(mode.timeUp).toBe(false);
  });

  it('ends a time attack after the limit and blocks further hits', () => {
    const mode = new PunchingBagMode('timeattack');
    punch(mode);
    runMode(mode, TIME_ATTACK_SECONDS);
    expect(mode.timeUp).toBe(true);
    expect(mode.timeLeft).toBe(0);
    expect(mode.drainEvents().some((e) => e.type === 'timeup')).toBe(true);
    const score = mode.stats.score;
    punch(mode);
    expect(mode.stats.totalHits).toBe(1);
    expect(mode.stats.score).toBe(score);
    expect(mode.player.attackCount).toBe(1);
  });

  it('resets hits, combo, score and timer on restart', () => {
    const mode = new PunchingBagMode('timeattack');
    punch(mode);
    punch(mode);
    runMode(mode, TIME_ATTACK_SECONDS);
    mode.restart();
    expect(mode.stats).toEqual({ totalHits: 0, punchHits: 0, kickHits: 0, combo: 0, bestCombo: 0, score: 0, time: 0 });
    expect(mode.timeUp).toBe(false);
    expect(mode.variant).toBe('timeattack');
    punch(mode);
    expect(mode.stats.totalHits).toBe(1);
  });
});
