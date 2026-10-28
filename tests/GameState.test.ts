import { describe, expect, it } from 'vitest';
import { START_X } from '../src/entities/Arena';
import { BALANCE } from '../src/game/CombatBalance';
import { GameModeManager, MAX_FRAME_TIME } from '../src/game/GameModeManager';
import { PunchingBagMode } from '../src/modes/PunchingBagMode';
import { KO_TIME, READY_TIME, SparringMode } from '../src/modes/SparringMode';
import { intent, runMode } from './helpers';
import { seededRandom } from './random';

function frames(manager: GameModeManager, seconds: number, held = intent()): void {
  for (let t = 0; t < seconds; t += 1 / 60) manager.update(1 / 60, held);
}

describe('SparringMode', () => {
  it('holds both fighters during READY, then starts the fight', () => {
    const mode = new SparringMode();
    runMode(mode, READY_TIME - 0.1, {}, { move: 1 });
    expect(mode.phase).toBe('ready');
    expect(mode.player.x).toBe(START_X.left);
    runMode(mode, 0.2);
    expect(mode.phase).toBe('fight');
    expect(mode.drainEvents().some((e) => e.type === 'fight')).toBe(true);
  });

  it('declares the winner when health reaches 0, then shows the result', () => {
    const mode = new SparringMode();
    runMode(mode, READY_TIME + 0.05);
    mode.cpu.health = 1;
    mode.cpu.x = mode.player.x + 25;
    runMode(mode, 0.3, { punch: true });
    expect(mode.winner).toBe('left');
    expect(mode.phase).toBe('ko');
    expect(mode.player.state).toBe('victory');
    expect(mode.cpu.state).toBe('knockout');
    expect(mode.active).toBe(false);

    runMode(mode, KO_TIME);
    expect(mode.phase).toBe('over');
    expect(mode.cpu.state).toBe('defeat');
  });

  it('ignores attacks and movement after the fight ends', () => {
    const mode = new SparringMode();
    runMode(mode, READY_TIME + 0.05);
    mode.cpu.health = 1;
    mode.cpu.x = mode.player.x + 25;
    runMode(mode, 0.3, { punch: true });
    const x = mode.player.x;
    runMode(mode, 1, { kick: true }, { move: -1 });
    expect(mode.player.x).toBe(x);
    expect(mode.player.attackCount).toBe(1);
  });

  it('restarts with full health and a fresh READY', () => {
    const mode = new SparringMode();
    runMode(mode, READY_TIME + 0.05);
    mode.cpu.health = 1;
    mode.cpu.x = mode.player.x + 25;
    runMode(mode, 0.3 + KO_TIME, { punch: true });
    mode.restart();
    expect(mode.phase).toBe('ready');
    expect(mode.winner).toBeNull();
    for (const fighter of [mode.player, mode.cpu]) {
      expect(fighter.health).toBe(BALANCE.maxHealth);
      expect(fighter.state).toBe('idle');
    }
    expect([mode.player.x, mode.cpu.x]).toEqual([START_X.left, START_X.right]);
  });
});

describe('GameModeManager', () => {
  it('starts on the mode select screen', () => {
    const manager = new GameModeManager();
    expect(manager.screen).toBe('select');
    expect(manager.update(1, intent())).toBe(0);
  });

  it('does not advance anything while paused', () => {
    const manager = new GameModeManager(seededRandom(2));
    const mode = manager.enter('sparring') as SparringMode;
    frames(manager, READY_TIME + 0.5);
    manager.paused = true;
    const snapshot = JSON.stringify({ phase: mode.phase, time: mode.phaseTime, p: mode.player, c: mode.cpu });
    frames(manager, 5, intent({ move: 1, punch: true }));
    expect(JSON.stringify({ phase: mode.phase, time: mode.phaseTime, p: mode.player, c: mode.cpu })).toBe(snapshot);

    manager.paused = false;
    frames(manager, 0.1);
    expect(mode.phaseTime).toBeGreaterThan(0.5);
  });

  it('caps long frames so nothing jumps after the window was hidden', () => {
    const manager = new GameModeManager();
    const mode = manager.enter('sandbag');
    manager.update(30, intent({ move: -1 }));
    expect(mode instanceof PunchingBagMode && mode.stats.time).toBeCloseTo(MAX_FRAME_TIME, 2);
  });

  it('keeps a key press that arrives on a frame too short for a step', () => {
    const manager = new GameModeManager();
    const mode = manager.enter('sandbag');
    manager.update(0.001, intent({ punch: true }));
    expect(mode.player.attackCount).toBe(0);
    manager.update(1 / 60, intent());
    expect(mode.player.attackCount).toBe(1);
  });

  it('runs a press only once even when a frame covers several steps', () => {
    const manager = new GameModeManager();
    const mode = manager.enter('sandbag');
    manager.update(0.5, intent({ punch: true }));
    manager.update(0.5, intent());
    expect(mode.player.attackCount).toBe(1);
  });

  it('builds each mode fresh, so nothing carries over between modes', () => {
    const manager = new GameModeManager();
    const bag = manager.enter('sandbag') as PunchingBagMode;
    manager.update(1 / 60, intent({ punch: true }));
    frames(manager, 0.5);
    expect(bag.stats.totalHits).toBe(1);

    manager.exitToSelect();
    expect(manager.mode).toBeNull();
    manager.enter('sparring');
    const again = manager.enter('sandbag') as PunchingBagMode;
    expect(again).not.toBe(bag);
    expect(again.stats.totalHits).toBe(0);
  });

  it('restarts the current mode and unpauses', () => {
    const manager = new GameModeManager();
    const bag = manager.enter('sandbag') as PunchingBagMode;
    manager.update(1 / 60, intent({ punch: true }));
    frames(manager, 0.5);
    manager.paused = true;
    manager.restart();
    expect(manager.paused).toBe(false);
    expect(bag.stats.totalHits).toBe(0);
  });

  it('applies a difficulty change to the running fight', () => {
    const manager = new GameModeManager();
    const mode = manager.enter('sparring') as SparringMode;
    manager.setDifficulty('hard');
    expect(mode.ai.difficulty).toBe('hard');
    expect((manager.enter('sparring') as SparringMode).ai.difficulty).toBe('hard');
  });
});
