import { describe, expect, it } from 'vitest';
import { clampToRing } from '../src/entities/Arena';
import { Fighter } from '../src/entities/Fighter';
import { AI_SETTINGS, AIController, DIFFICULTIES } from '../src/game/AIController';
import { ATTACKS, BALANCE } from '../src/game/CombatBalance';
import { resolveExchange } from '../src/game/CombatSystem';
import { IDLE_INTENT } from '../src/game/GameState';
import { STEP } from '../src/modes/GameMode';
import { SparringMode } from '../src/modes/SparringMode';
import { run, runMode } from './helpers';
import { seededRandom } from './random';

function setup(seed = 1) {
  const ai = new AIController('normal', seededRandom(seed));
  ai.reset();
  const self = new Fighter('right', 160);
  const foe = new Fighter('left', 100);
  return { ai, self, foe };
}

describe('AIController', () => {
  it('does nothing once it is knocked out', () => {
    const { ai, self, foe } = setup();
    self.health = 0;
    self.state = 'knockout';
    for (let i = 0; i < 240; i++) expect(ai.getIntent(self, foe, STEP)).toEqual(IDLE_INTENT);
  });

  it('stops once the player is down', () => {
    const { ai, self, foe } = setup();
    foe.state = 'knockout';
    for (let i = 0; i < 240; i++) expect(ai.getIntent(self, foe, STEP)).toEqual(IDLE_INTENT);
  });

  it('walks toward a far away player', () => {
    const { ai, self, foe } = setup();
    for (let i = 0; i < 120; i++) {
      self.faceToward(foe.x);
      self.update(STEP, ai.getIntent(self, foe, STEP), clampToRing);
    }
    expect(self.x).toBeLessThan(160);
  });

  it('attacks a player standing in range, but not every frame', () => {
    const { ai, self, foe } = setup();
    self.x = foe.x + ATTACKS.punch.reachEnd + BALANCE.bodyHalfWidth - 4;
    let attacks = 0;
    for (let i = 0; i < 240; i++) {
      const next = ai.getIntent(self, foe, STEP);
      if (next.command) attacks++;
      self.faceToward(foe.x);
      self.update(STEP, next, clampToRing);
    }
    expect(attacks).toBeGreaterThan(0);
    // Two seconds at the fastest rhythm still leaves time between attacks.
    expect(attacks).toBeLessThan(2 / AI_SETTINGS.normal.attackRest + 2);
  });

  it('decides on a rhythm instead of changing its mind every frame', () => {
    const { ai, self, foe } = setup(3);
    let changes = 0;
    let last = 0;
    for (let i = 0; i < 120; i++) {
      const next = ai.getIntent(self, foe, STEP);
      if (next.move !== last) changes++;
      last = next.move;
      self.update(STEP, next, clampToRing);
    }
    expect(changes).toBeLessThanOrEqual(1 / (AI_SETTINGS.normal.decisionInterval * 0.7) + 1);
  });

  it('reacts to a player attack only after its reaction time', () => {
    let guarded = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { ai, self, foe } = setup(seed);
      self.x = foe.x + 25;
      ai.getIntent(self, foe, STEP);
      run(foe, STEP, { kick: true });
      let firstDefense = Infinity;
      for (let t = 0; t < ATTACKS.kick.startup; t += STEP) {
        const next = ai.getIntent(self, foe, STEP);
        if ((next.guard || next.dodge) && firstDefense === Infinity) firstDefense = t;
        foe.update(STEP, IDLE_INTENT, clampToRing);
      }
      if (firstDefense !== Infinity) {
        guarded++;
        expect(firstDefense).toBeGreaterThanOrEqual(AI_SETTINGS.normal.reaction * 0.8 - STEP);
      }
    }
    // Sometimes it defends, sometimes it doesn't.
    expect(guarded).toBeGreaterThan(0);
    expect(guarded).toBeLessThan(40);
  });

  it('beats a player who never moves', () => {
    const mode = new SparringMode(new AIController('normal', seededRandom(7)));
    runMode(mode, 60);
    expect(mode.winner).toBe('right');
    expect(mode.cpu.health).toBe(BALANCE.maxHealth);
  });

  it('finishes AI-vs-AI fights on every difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      const rng = seededRandom(11);
      const left = new AIController(difficulty, rng);
      const right = new AIController(difficulty, rng);
      left.reset();
      right.reset();
      const a = new Fighter('left', 84);
      const b = new Fighter('right', 156);
      let time = 0;
      while (a.health > 0 && b.health > 0 && time < 180) {
        const ia = left.getIntent(a, b, STEP);
        const ib = right.getIntent(b, a, STEP);
        a.faceToward(b.x);
        b.faceToward(a.x);
        a.update(STEP, ia, clampToRing);
        b.update(STEP, ib, clampToRing);
        resolveExchange(a, b, 120);
        time += STEP;
      }
      expect(Math.min(a.health, b.health), difficulty).toBe(0);
    }
  });
});
