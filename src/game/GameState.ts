// Types shared by the game logic, the modes and the renderer.

export type Side = 'left' | 'right';

/** 1 = facing right, -1 = facing left. */
export type Facing = 1 | -1;

/** Every attack. Which one comes out depends on the button, the stick and whether the fighter is in the air. */
export type AttackKind =
  | 'punch'
  | 'kick'
  | 'lowJab'
  | 'sweep'
  | 'uppercut'
  | 'straight'
  | 'dropkick'
  | 'jumpPunch'
  | 'jumpKick';

/**
 * Where an attack hits, Tekken style. High attacks whiff over a crouching fighter, lows miss a
 * jumping one and must be blocked crouching, overheads (jump attacks) must be blocked standing.
 */
export type AttackLevel = 'high' | 'mid' | 'low' | 'overhead';

export type FighterState =
  | 'idle'
  | 'move'
  | 'crouch'
  | 'attack'
  | 'guard'
  | 'dodge'
  | 'jumpsquat'
  | 'air'
  | 'hit'
  | 'knockdown'
  | 'getup'
  | 'knockout'
  | 'victory'
  | 'defeat';

export type ModeKind = 'sparring' | 'sandbag';

/** What a controller (keyboard or AI) wants a fighter to do this frame. */
export interface Intent {
  /** Horizontal movement, -1 (left) .. 1 (right). */
  move: number;
  /** Held: crouch (S). */
  crouch: boolean;
  /** Edge-triggered: true only on the frame the key went down. */
  jump: boolean;
  punch: boolean;
  kick: boolean;
  dodge: boolean;
  /** Held. */
  guard: boolean;
  /**
   * Starts this attack directly instead of reading it from buttons and stick motions.
   * The AI uses it; it follows the same rules (only when the fighter is free to act).
   */
  command?: AttackKind;
}

export const IDLE_INTENT: Intent = {
  move: 0,
  crouch: false,
  jump: false,
  punch: false,
  kick: false,
  dodge: false,
  guard: false,
};

/** Things that happened during an update, for effects and sounds. They never feed back into the game. */
export type CombatEvent =
  | { type: 'hit'; x: number; y: number; kind: AttackKind; target: Side | 'bag'; heavy: boolean; combo?: number }
  | { type: 'guard'; x: number; y: number; kind: AttackKind }
  | { type: 'dodge'; x: number; y: number }
  | { type: 'special'; name: string; x: number; y: number }
  | { type: 'jump'; x: number; facing: Facing }
  | { type: 'land'; x: number }
  | { type: 'knockout'; loser: Side; x: number }
  | { type: 'fight' }
  | { type: 'timeup' };

export function opposite(side: Side): Side {
  return side === 'left' ? 'right' : 'left';
}
