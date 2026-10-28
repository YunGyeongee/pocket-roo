import { WORLD_HEIGHT, WORLD_WIDTH } from '../entities/Arena';
import { drawCenteredText, drawText, PALETTE, textWidth } from '../rendering/PixelAssets';

interface MoveEntry {
  keys: string;
  name: string;
  note?: string;
}

/** Commands are written for a kangaroo facing right; FWD means toward the opponent. */
const MOVES: readonly MoveEntry[] = [
  { keys: 'J', name: 'JAB', note: 'HIGH' },
  { keys: 'K', name: 'KICK', note: 'MID' },
  { keys: 'S+J', name: 'LOW JAB', note: 'LOW' },
  { keys: 'S+K', name: 'TAIL SWEEP', note: 'LOW, DOWN' },
  { keys: 'S+FWD+J', name: 'UPPERCUT', note: 'ANTI AIR' },
  { keys: 'S,FWD+J', name: 'POWER STRAIGHT', note: 'RUSH' },
  { keys: 'S,FWD+K', name: 'TAIL DROP KICK', note: 'DOWN' },
  { keys: 'W', name: 'TAIL JUMP' },
  { keys: 'AIR J/K', name: 'JUMP ATTACK', note: 'OVERHEAD' },
  { keys: 'L / S+L', name: 'GUARD / LOW GUARD' },
  { keys: 'SPACE', name: 'BACKSTEP' },
];

const LEFT = 14;
const NAME_X = 52;
const TOP = 18;
const LINE = 8;

/** Fighting game style command list, shown from the pause menu. */
export function drawMoveList(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.94)';
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  drawCenteredText(ctx, 'MOVE LIST', WORLD_WIDTH / 2, 6, PALETTE.yellow);
  MOVES.forEach((move, index) => {
    const y = TOP + index * LINE;
    drawText(ctx, move.keys, LEFT, y, PALETTE.white);
    drawText(ctx, move.name, NAME_X, y, PALETTE.lightGrey);
    if (move.note) drawText(ctx, move.note, WORLD_WIDTH - LEFT - textWidth(move.note), y, PALETTE.lavender);
  });
  const bottom = TOP + MOVES.length * LINE + 3;
  drawCenteredText(ctx, 'FWD = TOWARD THE OPPONENT, S,FWD = DOWN THEN FWD', WORLD_WIDTH / 2, bottom, PALETTE.lightGrey);
  drawCenteredText(ctx, 'BLOCK LOWS CROUCHING, JUMP ATTACKS STANDING', WORLD_WIDTH / 2, bottom + 8, PALETTE.orange);
  drawCenteredText(ctx, 'ESC OR ENTER TO GO BACK', WORLD_WIDTH / 2, bottom + 17, PALETTE.lavender);
}
