import type { AttackSpec } from './CombatBalance';
import type { Facing } from './GameState';

/** Horizontal extent [left, right]. Fights happen on one line, so hit tests only need x. */
export interface Span {
  left: number;
  right: number;
}

/** Anything that can be hit or pushed: fighters and the sandbag. */
export interface Body {
  x: number;
  readonly halfWidth: number;
}

export function bodySpan(body: Body): Span {
  return { left: body.x - body.halfWidth, right: body.x + body.halfWidth };
}

/** Where an attack reaches, in front of the attacker. */
export function attackSpan(x: number, facing: Facing, spec: Pick<AttackSpec, 'reachStart' | 'reachEnd'>): Span {
  const near = x + facing * spec.reachStart;
  const far = x + facing * spec.reachEnd;
  return { left: Math.min(near, far), right: Math.max(near, far) };
}

export function overlaps(a: Span, b: Span): boolean {
  return a.left <= b.right && b.left <= a.right;
}

/**
 * Pushes two bodies apart so they don't overlap. `aMovable`/`bMovable` say who may move;
 * `clamp` keeps the result inside the ring. Returns true if they were touching.
 */
export function separate(a: Body, b: Body, clamp: (x: number) => number, aMovable = true, bMovable = true): boolean {
  const minDistance = a.halfWidth + b.halfWidth;
  const distance = b.x - a.x;
  const overlap = minDistance - Math.abs(distance);
  if (overlap <= 0 || (!aMovable && !bMovable)) return false;
  const direction = distance >= 0 ? 1 : -1;
  if (aMovable && bMovable) {
    a.x = clamp(a.x - (direction * overlap) / 2);
    b.x = clamp(b.x + (direction * overlap) / 2);
    // Against the ropes one side can't give way; the other takes the rest.
    const left = minDistance - Math.abs(b.x - a.x);
    if (left > 0.001) {
      if (clamp(b.x + direction * left) !== b.x) b.x = clamp(b.x + direction * left);
      else a.x = clamp(a.x - direction * left);
    }
  } else if (aMovable) {
    a.x = clamp(b.x - direction * minDistance);
  } else {
    b.x = clamp(a.x + direction * minDistance);
  }
  return true;
}
