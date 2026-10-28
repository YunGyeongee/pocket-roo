import { ATTACKS, BALANCE, type AttackSpec } from '../game/CombatBalance';
import type { Body } from '../game/Collision';
import { CommandBuffer, toDirection } from '../game/CommandBuffer';
import type { AttackKind, AttackLevel, Facing, FighterState, Intent, Side } from '../game/GameState';
import { Attack } from './Attack';

const FINISHED_STATES: readonly FighterState[] = ['knockout', 'victory', 'defeat'];
/** Sideways speed of a fighter knocked off their feet. */
const KNOCKDOWN_DRIFT = 50;

/**
 * A kangaroo boxer. The player and the AI drive it through the same Intent, so both follow
 * exactly the same rules.
 *
 * State priority: finished (KO/victory/defeat) ignores everything; hit stun, knockdowns, dodges,
 * jumps and attacks run to the end before new input is read; only idle, move, crouch and guard
 * accept input. A clean hit interrupts anything except the finished states, including an attack.
 */
export class Fighter implements Body {
  readonly halfWidth = BALANCE.bodyHalfWidth;
  x = 0;
  /** Height of the feet above the floor. */
  y = 0;
  vx = 0;
  vy = 0;
  facing: Facing = 1;
  health: number = BALANCE.maxHealth;
  state: FighterState = 'idle';
  /** Time spent in the current state. */
  stateTime = 0;
  /** Free-running clock for idle breathing and walk cycles. */
  animTime = 0;
  attack: Attack | null = null;
  /** Counts attacks started, so the AI can tell a new attack from the one it already saw. */
  attackCount = 0;
  /** Low stance: high attacks whiff over it and its guard blocks lows. */
  crouching = false;
  /** Remaining hit stun (state 'hit'), guard stun ('guard') or time on the floor ('knockdown'). */
  stun = 0;
  dodgeCooldown = 0;
  /** Sliding speed after being hit, in pixels/s. */
  knockback = 0;
  /** Seconds since the last time this fighter took damage; drives the health bar flash. */
  sinceDamage = Infinity;
  private airAttackUsed = false;
  private readonly commands = new CommandBuffer();

  constructor(
    readonly side: Side,
    private readonly startX: number,
  ) {
    this.reset();
  }

  reset(): void {
    this.x = this.startX;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = this.side === 'left' ? 1 : -1;
    this.health = BALANCE.maxHealth;
    this.attack = null;
    this.attackCount = 0;
    this.crouching = false;
    this.stun = 0;
    this.dodgeCooldown = 0;
    this.knockback = 0;
    this.sinceDamage = Infinity;
    this.animTime = 0;
    this.airAttackUsed = false;
    this.commands.clear();
    this.setState('idle');
  }

  get finished(): boolean {
    return FINISHED_STATES.includes(this.state);
  }

  get airborne(): boolean {
    return this.state === 'air' || this.y > 0;
  }

  /** Free to start a new action. */
  get canAct(): boolean {
    const free = this.state === 'idle' || this.state === 'move' || this.state === 'crouch' || this.state === 'guard';
    return free && this.stun <= 0 && this.y === 0;
  }

  /** Can't be hit at all: the start of a backstep, or getting up off the floor. */
  get invulnerable(): boolean {
    return (this.state === 'dodge' && this.stateTime < BALANCE.dodge.invulnerable) || this.state === 'getup';
  }

  /** Whether an attack at `level` can touch this fighter right now. */
  reachableBy(level: AttackLevel): boolean {
    if (this.state === 'knockdown') return false;
    if (this.airborne) return level !== 'low';
    if (this.crouching) return level !== 'high';
    return true;
  }

  /** Immune to `level`, e.g. an uppercut rising through a jump-in. */
  invulnerableTo(level: AttackLevel): boolean {
    if (this.invulnerable) return true;
    const attack = this.attack;
    if (!attack || (attack.phase !== 'startup' && attack.phase !== 'active')) return false;
    return attack.spec.invulnerableTo?.includes(level) ?? false;
  }

  /** Blocks an attack from the front: standing guard stops all but lows, crouching guard all but overheads. */
  guardsAgainst(attackerFacing: Facing, level: AttackLevel): boolean {
    if (this.state !== 'guard' || this.facing !== -attackerFacing) return false;
    return this.crouching ? level !== 'overhead' : level !== 'low';
  }

  faceToward(x: number): void {
    if (!this.canAct || Math.abs(x - this.x) < 1) return;
    this.facing = x > this.x ? 1 : -1;
  }

  update(dt: number, intent: Intent, clamp: (x: number) => number): void {
    this.animTime += dt;
    this.stateTime += dt;
    this.sinceDamage += dt;
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    // Motions are recorded even while busy, so a special can be prepared during recovery.
    this.commands.record(toDirection(intent, this.facing), dt);
    this.slide(dt, clamp);
    this.fall(dt, clamp);

    switch (this.state) {
      case 'knockout':
      case 'victory':
      case 'defeat':
        return;
      case 'hit':
        this.stun -= dt;
        if (this.stun <= 0) this.setState('idle');
        return;
      case 'knockdown':
        if (this.y > 0) return;
        this.stun -= dt;
        if (this.stun <= 0) this.setState('getup');
        return;
      case 'getup':
        if (this.stateTime >= BALANCE.getupTime) this.setState('idle');
        return;
      case 'dodge':
        this.x = clamp(this.x - this.facing * BALANCE.dodge.speed * dt);
        if (this.stateTime >= BALANCE.dodge.duration) this.setState('idle');
        return;
      case 'jumpsquat':
        if (this.stateTime >= BALANCE.jump.squat) this.takeOff(intent.move);
        return;
      case 'air':
        this.updateAir(dt, intent);
        return;
      case 'attack':
        this.updateAttack(dt, intent, clamp);
        return;
      case 'guard':
        if (this.stun > 0) {
          this.stun -= dt;
          return;
        }
        break;
      case 'idle':
      case 'move':
      case 'crouch':
        break;
    }
    this.act(dt, intent, clamp);
  }

  /** A clean hit. Returns the damage taken. */
  takeHit(spec: AttackSpec, attackerFacing: Facing): number {
    const wasAirborne = this.airborne;
    this.damage(spec.damage);
    this.attack = null;
    this.crouching = false;
    if (this.health <= 0) {
      if (wasAirborne) this.vx = attackerFacing * KNOCKDOWN_DRIFT;
      return spec.damage;
    }
    if (spec.knockdown || wasAirborne) {
      // Off the feet: fly back (or fall), lie down a moment, then get up.
      this.setState('knockdown');
      this.stun = BALANCE.knockdownTime;
      if (wasAirborne || spec.launch) {
        this.vx = attackerFacing * KNOCKDOWN_DRIFT;
        this.vy = Math.max(this.vy, spec.launch ?? 0);
      } else {
        this.knockback = attackerFacing * spec.knockback;
      }
      return spec.damage;
    }
    this.stun = spec.hitstun;
    this.knockback = attackerFacing * spec.knockback;
    this.setState('hit');
    return spec.damage;
  }

  /** A hit taken on the guard: reduced damage and a short guard stun. Returns the damage taken. */
  takeGuardedHit(spec: AttackSpec, attackerFacing: Facing): number {
    const amount = spec.damage * (1 - BALANCE.guardReduction);
    this.damage(amount);
    if (this.health <= 0) return amount;
    this.stun = spec.guardstun;
    this.knockback = attackerFacing * spec.knockback * 0.5;
    return amount;
  }

  /** Ends the fight for this fighter: a victory pose, or a sad sit after the knockdown. */
  finish(won: boolean): void {
    this.attack = null;
    this.stun = 0;
    this.knockback = 0;
    this.crouching = false;
    this.setState(won ? 'victory' : 'defeat');
  }

  private damage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    this.sinceDamage = 0;
    if (this.health <= 0) {
      this.attack = null;
      this.stun = 0;
      this.setState('knockout');
    }
  }

  private act(dt: number, intent: Intent, clamp: (x: number) => number): void {
    if (intent.dodge && this.dodgeCooldown <= 0) {
      this.crouching = false;
      this.dodgeCooldown = BALANCE.dodge.cooldown;
      this.setState('dodge');
      return;
    }
    if (intent.jump) {
      this.crouching = false;
      this.setState('jumpsquat');
      return;
    }
    // Holding guard means no attacking.
    if (intent.guard) {
      if (this.state !== 'guard') this.setState('guard');
      this.crouching = intent.crouch;
      // A crouching guard stands its ground, like crouching.
      if (!intent.crouch) this.walk(dt, intent.move, BALANCE.moveSpeed * BALANCE.guardMoveFactor, clamp);
      return;
    }
    const kind = intent.command ?? this.readAttack(intent);
    if (kind && !ATTACKS[kind].airborne) {
      this.startAttack(kind);
      return;
    }
    if (intent.crouch) {
      this.crouching = true;
      if (this.state !== 'crouch') this.setState('crouch');
      return;
    }
    this.crouching = false;
    const next = Math.abs(intent.move) > 0.05 ? 'move' : 'idle';
    if (this.state !== next) this.setState(next);
    this.walk(dt, intent.move, BALANCE.moveSpeed, clamp);
  }

  /** Turns button presses plus the stick into an attack, Street Fighter / Tekken style. */
  private readAttack(intent: Intent): AttackKind | null {
    if (intent.kick) {
      if (this.commands.quarterCircleForward()) return 'dropkick';
      return intent.crouch ? 'sweep' : 'kick';
    }
    if (intent.punch) {
      if (this.commands.quarterCircleForward()) return 'straight';
      if (intent.crouch && intent.move * this.facing > 0.05) return 'uppercut';
      return intent.crouch ? 'lowJab' : 'punch';
    }
    return null;
  }

  private startAttack(kind: AttackKind): void {
    this.attack = new Attack(kind);
    this.attackCount++;
    this.crouching = this.attack.spec.crouching ?? false;
    if (!this.attack.spec.airborne) this.setState('attack');
  }

  private updateAttack(dt: number, intent: Intent, clamp: (x: number) => number): void {
    const attack = this.attack;
    if (!attack) {
      this.setState('idle');
      return;
    }
    attack.elapsed += dt;
    const lunge = attack.spec.lunge;
    if (lunge && (attack.phase === 'startup' || attack.phase === 'active')) this.x = clamp(this.x + this.facing * lunge * dt);
    if (attack.phase === 'done') {
      this.attack = null;
      this.crouching = intent.crouch;
      this.setState(intent.crouch ? 'crouch' : 'idle');
    }
  }

  /** The tail has coiled; spring off it. */
  private takeOff(move: number): void {
    const direction = Math.abs(move) > 0.05 ? Math.sign(move) : 0;
    this.vy = BALANCE.jump.speed;
    this.vx = direction * BALANCE.jump.drift;
    this.airAttackUsed = false;
    this.setState('air');
  }

  private updateAir(dt: number, intent: Intent): void {
    if (this.attack) {
      this.attack.elapsed += dt;
      if (this.attack.phase === 'done') this.attack = null;
      return;
    }
    // One attack per jump.
    if (!this.airAttackUsed && (intent.punch || intent.kick)) {
      this.airAttackUsed = true;
      this.startAttack(intent.kick ? 'jumpKick' : 'jumpPunch');
    }
  }

  /** Gravity for anyone off the floor: jumpers, launched or knocked-out fighters. */
  private fall(dt: number, clamp: (x: number) => number): void {
    if (this.y <= 0 && this.vy <= 0) return;
    this.vy -= BALANCE.jump.gravity * dt;
    this.y += this.vy * dt;
    this.x = clamp(this.x + this.vx * dt);
    if (this.y > 0) return;
    this.y = 0;
    this.vy = 0;
    this.vx = 0;
    if (this.state === 'air') {
      // Landing cancels an unfinished jump attack.
      this.attack = null;
      this.setState('idle');
    }
  }

  private walk(dt: number, move: number, speed: number, clamp: (x: number) => number): void {
    this.x = clamp(this.x + Math.max(-1, Math.min(1, move)) * speed * dt);
  }

  private slide(dt: number, clamp: (x: number) => number): void {
    if (this.knockback === 0) return;
    this.x = clamp(this.x + this.knockback * dt);
    const slower = Math.abs(this.knockback) - BALANCE.knockbackFriction * dt;
    this.knockback = slower > 0 ? Math.sign(this.knockback) * slower : 0;
  }

  private setState(state: FighterState): void {
    this.state = state;
    this.stateTime = 0;
  }
}
