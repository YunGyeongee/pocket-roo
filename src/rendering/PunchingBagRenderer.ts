import type { PunchingBag } from '../entities/PunchingBag';
import { PALETTE } from './PixelAssets';

/** Top of the chain, where the bag swings from. */
export const BAG_PIVOT_Y = 14;
const CHAIN_BOTTOM = 50;
const BAG_TOP = 52;
const BAG_BOTTOM = 110;

const BAG_COLORS = {
  outline: '#2b1509',
  leather: '#b8323a',
  light: '#e2585a',
  shade: '#7a1c2c',
  band: '#2b2b3a',
  bandLight: '#5f5f78',
  chain: PALETTE.lightGrey,
};

/**
 * Draws the hanging bag. Swinging is a shear around the pivot: each row slides sideways by its
 * distance from the pivot, which keeps every pixel square instead of rotating them.
 */
export function drawPunchingBag(ctx: CanvasRenderingContext2D, bag: PunchingBag, groundY: number): void {
  const centerX = Math.round(bag.x);
  const lean = Math.sin(bag.angle);
  const shift = (y: number): number => Math.round((y - BAG_PIVOT_Y) * lean);
  const flash = bag.flash > 0;

  // Mount on the ceiling beam.
  ctx.fillStyle = PALETTE.darkGrey;
  ctx.fillRect(centerX - 8, BAG_PIVOT_Y - 3, 17, 3);
  ctx.fillStyle = PALETTE.lightGrey;
  ctx.fillRect(centerX - 2, BAG_PIVOT_Y - 1, 5, 1);

  // Chain: alternating links.
  for (let y = BAG_PIVOT_Y; y < CHAIN_BOTTOM; y++) {
    ctx.fillStyle = (y >> 1) % 2 === 0 ? BAG_COLORS.chain : PALETTE.darkGrey;
    ctx.fillRect(centerX + shift(y), y, 1, 1);
  }
  // Straps fanning out to the bag's top.
  ctx.fillStyle = PALETTE.darkGrey;
  for (let y = CHAIN_BOTTOM - 4; y < BAG_TOP; y++) {
    const spread = y - (CHAIN_BOTTOM - 4);
    ctx.fillRect(centerX + shift(y) - spread, y, 1, 1);
    ctx.fillRect(centerX + shift(y) + spread, y, 1, 1);
  }

  const half = bag.halfWidth;
  for (let y = BAG_TOP; y <= BAG_BOTTOM; y++) {
    const rowFromTop = y - BAG_TOP;
    const rowFromBottom = BAG_BOTTOM - y;
    // Rounded caps at both ends.
    const inset = rowFromTop < 2 ? 2 - rowFromTop : rowFromBottom < 3 ? [3, 2, 1][rowFromBottom] : 0;
    const left = centerX + shift(y) - half + inset;
    const width = half * 2 + 1 - inset * 2;
    const edge = rowFromTop === 0 || rowFromBottom === 0;
    const band = rowFromTop === 6 || rowFromTop === 7 || rowFromBottom === 8 || rowFromBottom === 9;

    ctx.fillStyle = BAG_COLORS.outline;
    ctx.fillRect(left, y, width, 1);
    if (edge) continue;
    const fill = flash ? PALETTE.white : band ? BAG_COLORS.band : BAG_COLORS.leather;
    ctx.fillStyle = fill;
    ctx.fillRect(left + 1, y, width - 2, 1);
    if (flash) continue;
    // Highlight on the left, shade on the right.
    ctx.fillStyle = band ? BAG_COLORS.bandLight : BAG_COLORS.light;
    ctx.fillRect(left + 2, y, 2, 1);
    ctx.fillStyle = band ? BAG_COLORS.outline : BAG_COLORS.shade;
    ctx.fillRect(left + width - 4, y, 2, 1);
  }

  // Shadow on the floor follows the bottom of the bag.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  const shadowX = centerX + shift(BAG_BOTTOM);
  ctx.fillRect(shadowX - 7, groundY, 15, 1);
}
