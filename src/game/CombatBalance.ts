import type { AttackKind, AttackLevel } from './GameState';

// Starting balance. Times are in seconds, distances in game pixels (the world is 240x140).

export interface AttackSpec {
  /** Shown when a special move starts; plain attacks have none. */
  name?: string;
  level: AttackLevel;
  /** Punch- or kick-type; the sandbag counts them separately. */
  family: 'punch' | 'kick';
  damage: number;
  /** Wind-up before the attack can connect. */
  startup: number;
  /** Window in which the attack connects. */
  active: number;
  /** Cool-down after the active window; the fighter can't act until it ends. */
  recovery: number;
  /** Hitbox, measured forward from the attacker's center. */
  reachStart: number;
  reachEnd: number;
  /** How long a clean hit stuns the defender. */
  hitstun: number;
  /** How long a guarded hit locks the defender in guard. */
  guardstun: number;
  /** Speed the defender is pushed back with on a clean hit. */
  knockback: number;
  /** Game freezes this long when the hit lands. */
  hitstop: number;
  /** Sandbag practice score. */
  score: number;
  /** Knocks the defender off their feet. */
  knockdown?: boolean;
  /** Upward speed given to the defender on a clean hit (uppercut launch). */
  launch?: number;
  /** The attacker slides forward this fast during startup and active. */
  lunge?: number;
  /** Fighter stays low (high attacks whiff over it) while doing this attack. */
  crouching?: boolean;
  /** Can't be hit by these levels until the attack's active window ends. */
  invulnerableTo?: readonly AttackLevel[];
  /** Done in the air; it ends on landing. */
  airborne?: boolean;
}

export const ATTACKS: Record<AttackKind, AttackSpec> = {
  // J: quick jab to the head. Whiffs over a crouching opponent.
  punch: {
    level: 'high', family: 'punch', damage: 6,
    startup: 0.1, active: 0.08, recovery: 0.14, reachStart: 4, reachEnd: 22,
    hitstun: 0.2, guardstun: 0.1, knockback: 45, hitstop: 0.04, score: 10,
  },
  // K: hind leg kick to the body.
  kick: {
    level: 'mid', family: 'kick', damage: 12,
    startup: 0.24, active: 0.1, recovery: 0.3, reachStart: 6, reachEnd: 28,
    hitstun: 0.34, guardstun: 0.22, knockback: 100, hitstop: 0.09, score: 25,
  },
  // S+J: crouching jab at the shins. Fast, weak, must be blocked low.
  lowJab: {
    level: 'low', family: 'punch', damage: 4, crouching: true,
    startup: 0.08, active: 0.07, recovery: 0.14, reachStart: 4, reachEnd: 21,
    hitstun: 0.16, guardstun: 0.08, knockback: 30, hitstop: 0.03, score: 8,
  },
  // S+K: the tail swings along the floor and sweeps the legs.
  sweep: {
    name: 'TAIL SWEEP', level: 'low', family: 'kick', damage: 9, crouching: true, knockdown: true,
    startup: 0.2, active: 0.1, recovery: 0.4, reachStart: 4, reachEnd: 31,
    hitstun: 0.3, guardstun: 0.2, knockback: 40, hitstop: 0.07, score: 22,
  },
  // Down-forward + J: rising uppercut. Beats jump-ins: upper body can't be hit while it rises.
  uppercut: {
    name: 'UPPERCUT', level: 'mid', family: 'punch', damage: 13, knockdown: true, launch: 150,
    invulnerableTo: ['high', 'overhead'],
    startup: 0.12, active: 0.12, recovery: 0.42, reachStart: 2, reachEnd: 20,
    hitstun: 0.3, guardstun: 0.2, knockback: 40, hitstop: 0.1, score: 30,
  },
  // Down, forward + J: a lunging straight that crosses half the ring.
  straight: {
    name: 'POWER STRAIGHT', level: 'mid', family: 'punch', damage: 14, lunge: 120,
    startup: 0.2, active: 0.1, recovery: 0.35, reachStart: 4, reachEnd: 24,
    hitstun: 0.36, guardstun: 0.24, knockback: 150, hitstop: 0.1, score: 35,
  },
  // Down, forward + K: leans back on the tail and drives both feet forward. The kangaroo special.
  dropkick: {
    name: 'TAIL DROP KICK', level: 'mid', family: 'kick', damage: 18, knockdown: true, lunge: 80,
    startup: 0.3, active: 0.14, recovery: 0.5, reachStart: 6, reachEnd: 30,
    hitstun: 0.4, guardstun: 0.3, knockback: 160, hitstop: 0.13, score: 50,
  },
  // J in the air.
  jumpPunch: {
    level: 'overhead', family: 'punch', damage: 6, airborne: true,
    startup: 0.05, active: 0.3, recovery: 0.1, reachStart: 2, reachEnd: 20,
    hitstun: 0.24, guardstun: 0.12, knockback: 50, hitstop: 0.05, score: 15,
  },
  // K in the air.
  jumpKick: {
    level: 'overhead', family: 'kick', damage: 10, airborne: true,
    startup: 0.08, active: 0.35, recovery: 0.1, reachStart: 4, reachEnd: 25,
    hitstun: 0.3, guardstun: 0.18, knockback: 80, hitstop: 0.08, score: 25,
  },
};

export const BALANCE = {
  maxHealth: 100,
  moveSpeed: 58,
  /** Movement speed multiplier while guarding. */
  guardMoveFactor: 0.4,
  /** Share of damage a guard blocks. */
  guardReduction: 0.7,
  dodge: {
    /** Total backstep time; the fighter can't act during it. */
    duration: 0.3,
    /** Invulnerable for this long from the start of the dodge. */
    invulnerable: 0.18,
    speed: 140,
    /** Time from one dodge to the next. */
    cooldown: 0.8,
  },
  jump: {
    /** The tail coils before the kangaroo springs off it. */
    squat: 0.08,
    /** Upward speed at takeoff and gravity; together about 0.6s in the air and 32px high. */
    speed: 200,
    gravity: 640,
    /** Sideways speed when jumping forward or back. */
    drift: 70,
    /** Jump attacks only connect once the attacker is this low (feet at head height). */
    attackHeight: 26,
  },
  /** Lying on the floor after a knockdown, then getting up (invulnerable). */
  knockdownTime: 0.6,
  getupTime: 0.35,
  /** Stick motions (down, forward + button) must be done within this long. */
  commandWindow: 0.35,
  /** Knockback slows down at this rate (pixels/s per second). */
  knockbackFriction: 500,
  /** Fighters and the bag can't get closer than the sum of their half widths. */
  bodyHalfWidth: 10,
} as const;
