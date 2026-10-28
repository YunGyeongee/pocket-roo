import type { Attack } from '../entities/Attack';
import type { Fighter } from '../entities/Fighter';
import { BALANCE } from './CombatBalance';
import { attackSpan, bodySpan, overlaps, type Body } from './Collision';
import type { AttackKind, AttackLevel } from './GameState';

export type HitResult = 'hit' | 'guarded' | 'dodged';

export interface HitOutcome {
  result: HitResult;
  kind: AttackKind;
  attacker: Fighter;
  damage: number;
  /** Point of impact, for effects. */
  x: number;
  y: number;
}

/** Impact heights above the target's feet, by attack level. */
const IMPACT_HEIGHT: Record<AttackLevel, number> = { high: 27, overhead: 25, mid: 17, low: 4 };

/**
 * The attack that would land on `target` right now, or null. Shared by both modes so a punch
 * reaches exactly as far against the sandbag as against the AI. Only horizontal reach is checked
 * here; heights (crouching, jumping) are up to the caller.
 */
export function connectingAttack(attacker: Fighter, target: Body): Attack | null {
  const attack = attacker.attack;
  if (!attack || !attack.canConnect || attacker.finished) return null;
  // A jump attack connects on the way down, once the feet are at head height.
  if (attack.spec.airborne && attacker.y > BALANCE.jump.attackHeight) return null;
  return overlaps(attackSpan(attacker.x, attacker.facing, attack.spec), bodySpan(target)) ? attack : null;
}

/** Where on `target` an attack from `attacker` lands. */
export function impactPoint(attacker: Fighter, target: Body & { y?: number }, attack: Attack, groundY: number): { x: number; y: number } {
  return { x: target.x - attacker.facing * target.halfWidth, y: groundY - (target.y ?? 0) - IMPACT_HEIGHT[attack.spec.level] };
}

/**
 * Resolves both fighters' attacks against each other at the same moment, so neither side wins
 * a trade just by being updated first. Each attack connects at most once.
 */
export function resolveExchange(a: Fighter, b: Fighter, groundY: number): HitOutcome[] {
  // Decide everything from the state before any hit is applied.
  const pending = [
    { attacker: a, defender: b, attack: connectingAttack(a, b) },
    { attacker: b, defender: a, attack: connectingAttack(b, a) },
  ].filter((p) => p.attack && !p.defender.finished && p.defender.reachableBy(p.attack.spec.level));

  const outcomes: HitOutcome[] = [];
  for (const { attacker, defender, attack } of pending) {
    if (!attack) continue;
    const point = impactPoint(attacker, defender, attack, groundY);
    outcomes.push({ ...resolveHit(attack, attacker, defender), kind: attack.kind, attacker, ...point });
  }
  return outcomes;
}

function resolveHit(attack: Attack, attacker: Fighter, defender: Fighter): { result: HitResult; damage: number } {
  // A dodged attack is spent too: it can't catch the defender once the invulnerability ends.
  attack.connected = true;
  const level = attack.spec.level;
  if (defender.invulnerableTo(level)) return { result: 'dodged', damage: 0 };
  if (defender.guardsAgainst(attacker.facing, level)) {
    return { result: 'guarded', damage: defender.takeGuardedHit(attack.spec, attacker.facing) };
  }
  return { result: 'hit', damage: defender.takeHit(attack.spec, attacker.facing) };
}
