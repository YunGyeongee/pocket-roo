import { clampToRing, GROUND_Y, START_X } from '../entities/Arena';
import { Fighter } from '../entities/Fighter';
import { AIController } from '../game/AIController';
import { separate } from '../game/Collision';
import { ATTACKS } from '../game/CombatBalance';
import { resolveExchange } from '../game/CombatSystem';
import { IDLE_INTENT, type CombatEvent, type Intent, type Side } from '../game/GameState';
import { FighterWatcher, Hitstop, type GameMode } from './GameMode';

export type MatchPhase = 'ready' | 'fight' | 'ko' | 'over';

/** "READY" banner before the fight starts. */
export const READY_TIME = 1.2;
/** The loser stays down this long before the result shows. */
export const KO_TIME = 1.4;
/** Fighters this far apart in height pass over each other instead of pushing. */
const JUMP_OVER_HEIGHT = 22;

/** Player (left) against the AI (right), one round, first to drop the other's health to 0 wins. */
export class SparringMode implements GameMode {
  readonly kind = 'sparring';
  readonly player = new Fighter('left', START_X.left);
  readonly cpu = new Fighter('right', START_X.right);
  phase: MatchPhase = 'ready';
  phaseTime = 0;
  winner: Side | 'draw' | null = null;
  private events: CombatEvent[] = [];
  private readonly hitstop = new Hitstop();
  private readonly watchers = [new FighterWatcher(this.player), new FighterWatcher(this.cpu)];

  constructor(readonly ai: AIController = new AIController()) {
    this.restart();
  }

  get active(): boolean {
    return this.phase === 'ready' || this.phase === 'fight';
  }

  restart(): void {
    this.player.reset();
    this.cpu.reset();
    this.ai.reset();
    this.phase = 'ready';
    this.phaseTime = 0;
    this.winner = null;
    this.events = [];
    this.hitstop.remaining = 0;
    for (const watcher of this.watchers) watcher.reset();
  }

  drainEvents(): CombatEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  step(dt: number, intent: Intent): void {
    if (this.hitstop.consume(dt)) return;
    this.phaseTime += dt;

    const fighting = this.phase === 'fight';
    const playerIntent = fighting ? intent : IDLE_INTENT;
    const cpuIntent = fighting ? this.ai.getIntent(this.cpu, this.player, dt) : IDLE_INTENT;
    this.player.faceToward(this.cpu.x);
    this.cpu.faceToward(this.player.x);
    this.player.update(dt, playerIntent, clampToRing);
    this.cpu.update(dt, cpuIntent, clampToRing);
    // A high enough jump clears the other kangaroo, so it can land on the far side.
    if (Math.abs(this.player.y - this.cpu.y) < JUMP_OVER_HEIGHT) separate(this.player, this.cpu, clampToRing);
    for (const watcher of this.watchers) watcher.watch(GROUND_Y, this.events);

    switch (this.phase) {
      case 'ready':
        if (this.phaseTime >= READY_TIME) {
          this.setPhase('fight');
          this.events.push({ type: 'fight' });
        }
        break;
      case 'fight':
        this.resolveHits();
        break;
      case 'ko':
        if (this.phaseTime >= KO_TIME) {
          this.setPhase('over');
          for (const fighter of [this.player, this.cpu]) {
            if (fighter.state === 'knockout') fighter.finish(false);
          }
        }
        break;
      case 'over':
        break;
    }
  }

  private resolveHits(): void {
    for (const outcome of resolveExchange(this.player, this.cpu, GROUND_Y)) {
      const target = outcome.attacker === this.player ? 'right' : 'left';
      if (outcome.result === 'hit') {
        const heavy = ATTACKS[outcome.kind].damage >= ATTACKS.kick.damage;
        this.events.push({ type: 'hit', x: outcome.x, y: outcome.y, kind: outcome.kind, target, heavy });
        this.hitstop.trigger(ATTACKS[outcome.kind].hitstop);
      } else if (outcome.result === 'guarded') {
        this.events.push({ type: 'guard', x: outcome.x, y: outcome.y, kind: outcome.kind });
      } else {
        this.events.push({ type: 'dodge', x: outcome.x, y: outcome.y });
      }
    }

    const playerDown = this.player.health <= 0;
    const cpuDown = this.cpu.health <= 0;
    if (!playerDown && !cpuDown) return;
    // A trade can knock both out at once.
    this.winner = playerDown && cpuDown ? 'draw' : playerDown ? 'right' : 'left';
    for (const fighter of [this.player, this.cpu]) {
      if (fighter.health <= 0) this.events.push({ type: 'knockout', loser: fighter.side, x: fighter.x });
      else fighter.finish(true);
    }
    this.setPhase('ko');
  }

  private setPhase(phase: MatchPhase): void {
    this.phase = phase;
    this.phaseTime = 0;
  }
}
