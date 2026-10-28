import type { Fighter } from '../entities/Fighter';
import { ATTACKS, BALANCE } from './CombatBalance';
import { IDLE_INTENT, type AttackKind, type AttackLevel, type Intent } from './GameState';

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export interface AISettings {
  /** Delay before reacting to the player's attacks and jumps. */
  reaction: number;
  /** Time between decisions about moving and attacking. */
  decisionInterval: number;
  /** Chance to attack when a decision finds the player in range. */
  aggression: number;
  /** Chance to reach for a special move (straight, drop kick) instead of a plain attack. */
  specialChance: number;
  /** Chance to go low (low jab, tail sweep) when choosing a close attack. */
  lowChance: number;
  /** Chance to jump in from mid range. */
  jumpChance: number;
  /** Chances to guard / dodge a seen attack; guarding picks the right height. */
  guardChance: number;
  dodgeChance: number;
  /** Chance to answer a jump-in with an uppercut. */
  antiAirChance: number;
  /** Minimum pause between the AI's own attacks. */
  attackRest: number;
  /** Up to this many pixels of error when judging distance. */
  rangeError: number;
}

export const AI_SETTINGS: Record<Difficulty, AISettings> = {
  easy: {
    reaction: 0.34,
    decisionInterval: 0.4,
    aggression: 0.45,
    specialChance: 0.12,
    lowChance: 0.18,
    jumpChance: 0.06,
    guardChance: 0.25,
    dodgeChance: 0.06,
    antiAirChance: 0.15,
    attackRest: 0.8,
    rangeError: 7,
  },
  normal: {
    reaction: 0.22,
    decisionInterval: 0.28,
    aggression: 0.68,
    specialChance: 0.24,
    lowChance: 0.28,
    jumpChance: 0.11,
    guardChance: 0.42,
    dodgeChance: 0.14,
    antiAirChance: 0.45,
    attackRest: 0.46,
    rangeError: 4,
  },
  hard: {
    reaction: 0.14,
    decisionInterval: 0.2,
    aggression: 0.8,
    specialChance: 0.32,
    lowChance: 0.32,
    jumpChance: 0.12,
    guardChance: 0.56,
    dodgeChance: 0.22,
    antiAirChance: 0.7,
    attackRest: 0.3,
    rangeError: 2,
  },
};

/** Below this much health the AI defends more and backs off more often. */
const LOW_HEALTH = 35;
const LOW_HEALTH_DEFENSE = 1.4;
/** Extra time the guard is held after the attack it was raised for. */
const GUARD_HOLD_EXTRA = 0.15;
/** Jump-ins start from this distance band. */
const JUMP_IN_RANGE = { min: 40, max: 75 };
/** An uppercut is thrown when the jumping player comes this close. */
const ANTI_AIR_RANGE = 30;

/** Distance (center to center) at which an attack reaches the other fighter, counting any lunge. */
function reachDistance(kind: AttackKind): number {
  const spec = ATTACKS[kind];
  return spec.reachEnd + BALANCE.bodyHalfWidth + (spec.lunge ?? 0) * (spec.startup + spec.active);
}

/**
 * Computer opponent. It decides on a fixed rhythm instead of every frame, reacts to the player's
 * attacks only after a reaction delay, and misjudges distance a little, so it can be read and beaten.
 * It plays by the same rules as the player: every action goes through the same Intent.
 */
export class AIController {
  private move = 0;
  private press: AttackKind | null = null;
  private jump = false;
  private decisionTimer = 0;
  private restTimer = 0;
  private guardTimer = 0;
  private guardLow = false;
  private reactionTimer: number | null = null;
  /** Set when the AI has seen the player jump and decided to uppercut; waits until they're close. */
  private antiAir = false;
  private seenAttacks = 0;
  private sawAirborne = false;

  constructor(
    public difficulty: Difficulty = 'normal',
    private readonly rng: () => number = Math.random,
  ) {}

  get settings(): AISettings {
    return AI_SETTINGS[this.difficulty];
  }

  reset(): void {
    this.move = 0;
    this.press = null;
    this.jump = false;
    this.decisionTimer = this.settings.decisionInterval;
    this.restTimer = 0;
    this.guardTimer = 0;
    this.guardLow = false;
    this.reactionTimer = null;
    this.antiAir = false;
    this.seenAttacks = 0;
    this.sawAirborne = false;
  }

  getIntent(self: Fighter, foe: Fighter, dt: number): Intent {
    if (self.finished || foe.finished) {
      this.move = 0;
      this.press = null;
      return IDLE_INTENT;
    }
    this.decisionTimer -= dt;
    this.restTimer -= dt;
    this.guardTimer -= dt;
    const distance = Math.abs(foe.x - self.x);

    // Notice a new attack or a jump from the player, but only respond after the reaction delay.
    if (foe.attackCount !== this.seenAttacks) {
      this.seenAttacks = foe.attackCount;
      if (foe.attack) this.reactionTimer = this.reactionDelay();
    }
    if (foe.airborne && !this.sawAirborne && foe.state === 'air') {
      this.antiAir = this.rng() < this.settings.antiAirChance;
    }
    this.sawAirborne = foe.airborne;
    if (!foe.airborne) this.antiAir = false;

    const intent: Intent = { ...IDLE_INTENT, move: this.move };

    // In the air: kick on the way down if the player is close.
    if (self.airborne) {
      if (self.state === 'air' && !self.attack && self.vy < 0 && distance < reachDistance('jumpKick') + 6) intent.kick = true;
      return intent;
    }

    if (this.reactionTimer !== null) {
      this.reactionTimer -= dt;
      if (this.reactionTimer <= 0) {
        this.reactionTimer = null;
        if (this.react(self, foe)) intent.dodge = true;
      }
    }
    if (this.guardTimer > 0) {
      intent.guard = true;
      intent.crouch = this.guardLow;
      intent.move = 0;
      return intent;
    }
    if (!self.canAct || intent.dodge) return intent;

    if (this.antiAir && distance < ANTI_AIR_RANGE) {
      this.antiAir = false;
      intent.command = 'uppercut';
      this.restTimer = this.settings.attackRest;
      return intent;
    }
    if (this.press) {
      intent.command = this.press;
      this.press = null;
      this.move = 0;
      intent.move = 0;
    } else if (this.jump) {
      intent.jump = true;
      this.jump = false;
    } else if (this.decisionTimer <= 0) {
      this.decisionTimer = this.settings.decisionInterval * (0.7 + this.rng() * 0.6);
      this.decide(self, foe);
      intent.move = this.move;
    }
    return intent;
  }

  private reactionDelay(): number {
    return this.settings.reaction * (0.8 + this.rng() * 0.5);
  }

  /** Guards (at the right height) or dodges the attack it saw, if it's still coming. Returns true to dodge. */
  private react(self: Fighter, foe: Fighter): boolean {
    const attack = foe.attack;
    if (!attack || attack.connected || attack.phase === 'recovery' || attack.phase === 'done') return false;
    if (Math.abs(foe.x - self.x) > reachDistance(attack.kind) + 6) return false;
    const boost = self.health < LOW_HEALTH ? LOW_HEALTH_DEFENSE : 1;
    const roll = this.rng();
    const { dodgeChance, guardChance } = this.settings;
    if (roll < dodgeChance * boost && self.dodgeCooldown <= 0 && self.canAct) return true;
    if (roll < (dodgeChance + guardChance) * boost) {
      this.guardTimer = attack.duration - attack.elapsed + GUARD_HOLD_EXTRA;
      this.guardLow = guardLowAgainst(attack.spec.level, this.rng());
    }
    return false;
  }

  private decide(self: Fighter, foe: Fighter): void {
    const settings = this.settings;
    const toward = foe.x >= self.x ? 1 : -1;
    const distance = Math.abs(foe.x - self.x) + (this.rng() * 2 - 1) * settings.rangeError;
    const punchReach = reachDistance('punch');
    const kickReach = reachDistance('kick');
    const cautious = self.health < LOW_HEALTH;

    if (this.restTimer > 0) {
      // Just attacked: don't swing again yet. Sometimes step out of punch range.
      this.move = distance < punchReach - 2 && this.rng() < (cautious ? 0.6 : 0.35) ? -toward : 0;
      return;
    }
    if (distance > kickReach) {
      const special = distance < reachDistance('straight') && this.rng() < settings.specialChance;
      if (special) {
        this.attack(this.rng() < 0.5 ? 'straight' : 'dropkick');
      } else if (distance > JUMP_IN_RANGE.min && distance < JUMP_IN_RANGE.max && this.rng() < settings.jumpChance) {
        this.jump = true;
        this.move = toward;
      } else {
        this.move = toward;
      }
      return;
    }
    if (this.rng() < settings.aggression) {
      this.attack(this.chooseAttack(distance, punchReach, foe));
      return;
    }
    // Not attacking this time: hold position, close in for a punch, or back off.
    const roll = this.rng();
    if (roll < (cautious ? 0.45 : 0.2)) this.move = -toward;
    else if (roll < 0.6 && distance > punchReach) this.move = toward;
    else this.move = 0;
  }

  private chooseAttack(distance: number, punchReach: number, foe: Fighter): AttackKind {
    const { specialChance, lowChance } = this.settings;
    const close = distance <= punchReach;
    if (this.rng() < specialChance) return close ? 'uppercut' : 'dropkick';
    // A crouching player ducks high punches, so go for the body or the legs.
    if (this.rng() < lowChance || foe.crouching) return close && this.rng() < 0.5 ? 'lowJab' : 'sweep';
    return close && this.rng() < 0.65 ? 'punch' : 'kick';
  }

  private attack(kind: AttackKind): void {
    this.press = kind;
    this.move = 0;
    this.restTimer = this.settings.attackRest * (0.8 + this.rng() * 0.6);
  }
}

/** Lows must be blocked crouching and overheads standing; highs and mids are blocked standing, or ducked under. */
function guardLowAgainst(level: AttackLevel, roll: number): boolean {
  switch (level) {
    case 'low':
      return true;
    case 'overhead':
      return false;
    case 'high':
      return roll < 0.4;
    case 'mid':
      return roll < 0.3;
  }
}
