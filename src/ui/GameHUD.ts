import { WORLD_HEIGHT, WORLD_WIDTH } from '../entities/Arena';
import type { Fighter } from '../entities/Fighter';
import { BALANCE } from '../game/CombatBalance';
import type { GameMode } from '../modes/GameMode';
import { PunchingBagMode, TIME_ATTACK_SECONDS } from '../modes/PunchingBagMode';
import { READY_TIME, SparringMode } from '../modes/SparringMode';
import { drawCenteredText, drawOutlinedText, PALETTE, SKINS, textWidth } from '../rendering/PixelAssets';

const BLINK_RATE = 2.5;
const CENTER = WORLD_WIDTH / 2;
const BAR_WIDTH = 84;
const BAR_HEIGHT = 5;
const BAR_TOP = 11;
const DAMAGE_FLASH = 0.15;
const FIGHT_BANNER_TIME = 0.7;
const HINT_Y = WORLD_HEIGHT - 7;
/** Time attack clock turns red for the last seconds. */
const HURRY_TIME = 5;

export const CONTROL_HINTS = {
  sparring: 'W JUMP S DUCK J PUNCH K KICK L GUARD ESC MOVES',
  sandbag: 'W JUMP S DUCK J PUNCH K KICK R RESET',
} as const;

function blinkOn(time: number): boolean {
  return Math.floor(time * BLINK_RATE) % 2 === 0;
}

/** HUD for whichever mode is running. `time` (seconds) drives blinking. */
export function drawHUD(ctx: CanvasRenderingContext2D, mode: GameMode, time: number): void {
  if (mode instanceof SparringMode) drawSparringHUD(ctx, mode, time);
  else if (mode instanceof PunchingBagMode) drawSandbagHUD(ctx, mode, time);
}

function drawSparringHUD(ctx: CanvasRenderingContext2D, mode: SparringMode, time: number): void {
  drawOutlinedText(ctx, 'YOU', 6, 3, SKINS.left.g);
  drawOutlinedText(ctx, 'CPU', WORLD_WIDTH - 6 - textWidth('CPU'), 3, SKINS.right.g);
  drawCenteredText(ctx, mode.ai.difficulty.toUpperCase(), CENTER, 3, PALETTE.lavender);
  // Bars drain toward the outside, like in arcade fighters.
  drawHealthBar(ctx, mode.player, 6, 'left');
  drawHealthBar(ctx, mode.cpu, WORLD_WIDTH - 6 - BAR_WIDTH, 'right');
  drawCenteredText(ctx, 'VS', CENTER, BAR_TOP, PALETTE.lightGrey);
  drawOutlinedText(ctx, CONTROL_HINTS.sparring, CENTER - textWidth(CONTROL_HINTS.sparring) / 2, HINT_Y, PALETTE.lightGrey);

  switch (mode.phase) {
    case 'ready':
      drawCenteredText(ctx, 'READY', CENTER, 34, PALETTE.white, 2);
      if (mode.phaseTime < READY_TIME / 2) drawCenteredText(ctx, 'KNOCK OUT THE CPU!', CENTER, 48, PALETTE.lightGrey);
      break;
    case 'fight':
      if (mode.phaseTime < FIGHT_BANNER_TIME) drawCenteredText(ctx, 'FIGHT!', CENTER, 34, PALETTE.yellow, 2);
      break;
    case 'ko':
      drawCenteredText(ctx, 'K.O.!', CENTER, 32, PALETTE.red, 3);
      break;
    case 'over': {
      const title = mode.winner === 'left' ? 'YOU WIN!' : mode.winner === 'right' ? 'YOU LOSE' : 'DRAW';
      const color = mode.winner === 'left' ? PALETTE.yellow : mode.winner === 'right' ? SKINS.right.h : PALETTE.white;
      panel(ctx, 30);
      drawCenteredText(ctx, title, CENTER, 32, color, 2);
      drawCenteredText(ctx, `HP LEFT ${Math.ceil(mode.player.health)} - ${Math.ceil(mode.cpu.health)}`, CENTER, 48, PALETTE.lightGrey);
      if (blinkOn(time)) drawCenteredText(ctx, 'R REMATCH   ESC MENU', CENTER, 60, PALETTE.yellow);
      break;
    }
  }
}

function drawHealthBar(ctx: CanvasRenderingContext2D, fighter: Fighter, x: number, side: 'left' | 'right'): void {
  const ratio = Math.max(0, fighter.health / BALANCE.maxHealth);
  const fill = Math.ceil(BAR_WIDTH * ratio);
  ctx.fillStyle = PALETTE.black;
  ctx.fillRect(x - 1, BAR_TOP - 1, BAR_WIDTH + 2, BAR_HEIGHT + 2);
  ctx.fillStyle = PALETTE.plum;
  ctx.fillRect(x, BAR_TOP, BAR_WIDTH, BAR_HEIGHT);
  const flashing = fighter.sinceDamage < DAMAGE_FLASH;
  ctx.fillStyle = flashing ? PALETTE.white : ratio > 0.5 ? PALETTE.lime : ratio > 0.25 ? PALETTE.yellow : PALETTE.red;
  // The left bar is anchored at the center side and drains to the left; the right one mirrors it.
  const left = side === 'left' ? x + BAR_WIDTH - fill : x;
  ctx.fillRect(left, BAR_TOP, fill, BAR_HEIGHT);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillRect(left, BAR_TOP, fill, 1);
}

function drawSandbagHUD(ctx: CanvasRenderingContext2D, mode: PunchingBagMode, time: number): void {
  const stats = mode.stats;
  const timed = mode.variant === 'timeattack';

  drawOutlinedText(ctx, 'SCORE', 6, 3, PALETTE.lightGrey);
  drawOutlinedText(ctx, String(stats.score), 6, 10, PALETTE.yellow, 2);
  drawOutlinedText(ctx, `HITS ${stats.totalHits}`, 6, 23, PALETTE.white);
  drawOutlinedText(ctx, `PUNCH ${stats.punchHits}  KICK ${stats.kickHits}`, 6, 30, PALETTE.lightGrey);

  const clock = timed ? String(Math.ceil(mode.timeLeft)) : formatTime(stats.time);
  const hurry = timed && mode.timeLeft <= HURRY_TIME && !mode.timeUp;
  const clockColor = hurry && blinkOn(time * 2) ? PALETTE.red : PALETTE.white;
  const right = WORLD_WIDTH - 6;
  drawOutlinedText(ctx, timed ? 'TIME ATTACK' : 'FREE PRACTICE', right - textWidth(timed ? 'TIME ATTACK' : 'FREE PRACTICE'), 3, PALETTE.lavender);
  drawOutlinedText(ctx, clock, right - textWidth(clock, 2), 10, clockColor, 2);
  const combo = `COMBO ${stats.combo}`;
  const best = `BEST ${stats.bestCombo}`;
  drawOutlinedText(ctx, combo, right - textWidth(combo), 23, stats.combo >= 2 ? PALETTE.yellow : PALETTE.white);
  drawOutlinedText(ctx, best, right - textWidth(best), 30, PALETTE.lightGrey);

  const hint = `${CONTROL_HINTS.sandbag}  T ${timed ? 'FREE' : `${TIME_ATTACK_SECONDS}S RUN`}`;
  drawOutlinedText(ctx, hint, CENTER - textWidth(hint) / 2, HINT_Y, PALETTE.lightGrey);

  if (mode.timeUp) {
    panel(ctx, 40);
    drawCenteredText(ctx, 'TIME UP!', CENTER, 42, PALETTE.yellow, 2);
    drawCenteredText(ctx, `SCORE ${stats.score}`, CENTER, 58, PALETTE.white);
    drawCenteredText(ctx, `HITS ${stats.totalHits}  BEST COMBO ${stats.bestCombo}`, CENTER, 66, PALETTE.lightGrey);
    if (blinkOn(time)) drawCenteredText(ctx, 'R RETRY   T FREE PRACTICE', CENTER, 76, PALETTE.yellow);
  } else if (timed && stats.time < 1) {
    drawCenteredText(ctx, 'GO!', CENTER, 44, PALETTE.yellow, 2);
  }
}

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function panel(ctx: CanvasRenderingContext2D, top: number): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(36, top - 4, WORLD_WIDTH - 72, 46);
}
