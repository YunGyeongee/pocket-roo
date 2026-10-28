// The ring, in logical pixels. The renderer scales this up to the window.

export const WORLD_WIDTH = 240;
export const WORLD_HEIGHT = 140;

/** Where the fighters' feet touch the canvas. */
export const GROUND_Y = 120;

/** Corner posts; fighters stay between the ropes. */
export const RING_LEFT = 14;
export const RING_RIGHT = 226;

/** Range a fighter's center can move in. */
export const MOVE_MIN_X = RING_LEFT + 12;
export const MOVE_MAX_X = RING_RIGHT - 12;

export const START_X = { left: 84, right: 156 } as const;

export function clampToRing(x: number): number {
  return Math.max(MOVE_MIN_X, Math.min(MOVE_MAX_X, x));
}
