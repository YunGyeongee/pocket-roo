import type { Attack } from '../entities/Attack';
import { clampToRing, GROUND_Y } from '../entities/Arena';
import { Fighter } from '../entities/Fighter';
import { PunchingBag } from '../entities/PunchingBag';
import { separate } from '../game/Collision';
import { ATTACKS } from '../game/CombatBalance';
import { connectingAttack, impactPoint } from '../game/CombatSystem';
import { IDLE_INTENT, type CombatEvent, type Intent } from '../game/GameState';
import { FighterWatcher, Hitstop, type GameMode } from './GameMode';

export type SandbagVariant = 'free' | 'timeattack';

export const TIME_ATTACK_SECONDS = 30;
/** The combo drops if no hit lands within this long. */
export const COMBO_WINDOW = 1.2;
/** Each combo step adds this share to the hit score, up to COMBO_BONUS_CAP steps. */
const COMBO_BONUS = 0.1;
const COMBO_BONUS_CAP = 10;

export const PLAYER_START_X = 122;
export const BAG_X = 150;

export interface SandbagStats {
  totalHits: number;
  punchHits: number;
  kickHits: number;
  combo: number;
  bestCombo: number;
  score: number;
  /** Practice time; in time attack it stops at the limit. */
  time: number;
}

function emptyStats(): SandbagStats {
  return { totalHits: 0, punchHits: 0, kickHits: 0, combo: 0, bestCombo: 0, score: 0, time: 0 };
}

/** Practice against a sandbag: no health, no AI, just hit counts, combos and a practice score. */
export class PunchingBagMode implements GameMode {
  readonly kind = 'sandbag';
  readonly player = new Fighter('left', PLAYER_START_X);
  readonly bag = new PunchingBag(BAG_X);
  variant: SandbagVariant = 'free';
  stats = emptyStats();
  /** Time attack ran out; attacks are blocked until restart. */
  timeUp = false;
  private sinceHit = Infinity;
  /** The last attack that whiffed, so it only breaks the combo once. */
  private missed: Attack | null = null;
  private events: CombatEvent[] = [];
  private readonly hitstop = new Hitstop();
  private readonly watcher = new FighterWatcher(this.player);

  constructor(variant: SandbagVariant = 'free') {
    this.variant = variant;
    this.restart();
  }

  get active(): boolean {
    return !this.timeUp;
  }

  get timeLeft(): number {
    return Math.max(0, TIME_ATTACK_SECONDS - this.stats.time);
  }

  restart(): void {
    this.player.reset();
    this.bag.reset();
    this.stats = emptyStats();
    this.timeUp = false;
    this.sinceHit = Infinity;
    this.missed = null;
    this.events = [];
    this.hitstop.remaining = 0;
    this.watcher.reset();
  }

  drainEvents(): CombatEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  step(dt: number, intent: Intent): void {
    this.bag.update(dt);
    if (this.hitstop.consume(dt)) return;

    if (!this.timeUp) {
      this.stats.time += dt;
      if (this.variant === 'timeattack' && this.stats.time >= TIME_ATTACK_SECONDS) {
        this.stats.time = TIME_ATTACK_SECONDS;
        this.timeUp = true;
        this.stats.combo = 0;
        this.events.push({ type: 'timeup' });
      }
    }

    // Guard and dodge have nothing to do here, so those keys are ignored. Jumping and crouching work.
    const input = this.timeUp ? IDLE_INTENT : { ...intent, guard: false, dodge: false };
    this.player.faceToward(this.bag.x);
    this.player.update(dt, input, clampToRing);
    separate(this.player, this.bag, clampToRing, true, false);
    this.watcher.watch(GROUND_Y, this.events);
    if (this.timeUp) return;

    this.sinceHit += dt;
    if (this.sinceHit > COMBO_WINDOW) this.stats.combo = 0;

    const attack = connectingAttack(this.player, this.bag);
    if (attack) this.registerHit(attack);

    const current = this.player.attack;
    if (current && !current.connected && current.phase === 'recovery' && current !== this.missed) {
      // A whiff breaks the chain.
      this.missed = current;
      this.stats.combo = 0;
    }
  }

  private registerHit(attack: Attack): void {
    attack.connected = true;
    const stats = this.stats;
    stats.totalHits++;
    if (attack.spec.family === 'punch') stats.punchHits++;
    else stats.kickHits++;
    stats.combo++;
    stats.bestCombo = Math.max(stats.bestCombo, stats.combo);
    stats.score += Math.round(attack.spec.score * (1 + COMBO_BONUS * Math.min(stats.combo - 1, COMBO_BONUS_CAP)));
    this.sinceHit = 0;

    this.bag.hit(attack.spec.damage, this.player.facing);
    this.hitstop.trigger(attack.spec.hitstop);
    const point = impactPoint(this.player, this.bag, attack, GROUND_Y);
    const heavy = attack.spec.damage >= ATTACKS.kick.damage;
    this.events.push({ type: 'hit', ...point, kind: attack.kind, target: 'bag', heavy, combo: stats.combo });
  }
}
