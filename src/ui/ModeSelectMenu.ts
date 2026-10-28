import { WORLD_HEIGHT, WORLD_WIDTH } from '../entities/Arena';
import type { ModeKind } from '../game/GameState';
import { drawIcon } from '../rendering/CharacterRenderer';
import { drawCenteredText, GLOVE, HEADS, PALETTE, SKINS } from '../rendering/PixelAssets';

interface Card {
  mode: ModeKind;
  title: string;
  lines: [string, string];
}

const CARDS: readonly Card[] = [
  { mode: 'sparring', title: 'SPARRING', lines: ['1 ON 1 VS CPU', 'KNOCK IT OUT'] },
  { mode: 'sandbag', title: 'SANDBAG', lines: ['HIT, COMBO, SCORE', 'FREE OR 30S RUN'] },
];

const CARD_WIDTH = 96;
const CARD_HEIGHT = 70;
const CARD_TOP = 32;
const CARD_GAP = 12;
const CARDS_LEFT = (WORLD_WIDTH - CARD_WIDTH * 2 - CARD_GAP) / 2;
const CENTER = WORLD_WIDTH / 2;

function cardLeft(index: number): number {
  return CARDS_LEFT + index * (CARD_WIDTH + CARD_GAP);
}

/** Start screen: pick sparring or sandbag with A/D + Enter/J, or by clicking a card. */
export class ModeSelectMenu {
  selected = 0;

  get current(): ModeKind {
    return CARDS[this.selected].mode;
  }

  /** A picks the left card and D the right one; no wrapping around. */
  move(delta: number): void {
    this.selected = Math.max(0, Math.min(CARDS.length - 1, this.selected + delta));
  }

  /** Index of the card under a point in game coordinates, or -1. */
  hitTest(point: { x: number; y: number }): number {
    if (point.y < CARD_TOP || point.y > CARD_TOP + CARD_HEIGHT) return -1;
    return CARDS.findIndex((_, index) => point.x >= cardLeft(index) && point.x <= cardLeft(index) + CARD_WIDTH);
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.fillStyle = 'rgba(26, 28, 44, 0.7)';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    drawCenteredText(ctx, 'CORNER KANGAROO', CENTER, 9, PALETTE.yellow, 2);
    drawCenteredText(ctx, 'PICK A MODE', CENTER, 22, PALETTE.lightGrey);

    CARDS.forEach((card, index) => {
      const active = index === this.selected;
      // The chosen card bobs a pixel to look alive.
      const top = CARD_TOP - (active && Math.floor(time * 3) % 2 === 0 ? 1 : 0);
      const left = cardLeft(index);
      ctx.fillStyle = active ? PALETTE.yellow : PALETTE.lavender;
      ctx.fillRect(left - 1, top - 1, CARD_WIDTH + 2, CARD_HEIGHT + 2);
      ctx.fillStyle = active ? PALETTE.plum : PALETTE.navy;
      ctx.fillRect(left, top, CARD_WIDTH, CARD_HEIGHT);

      const middle = left + CARD_WIDTH / 2;
      drawCenteredText(ctx, card.title, middle, top + 5, active ? PALETTE.white : PALETTE.lightGrey, 2);
      if (card.mode === 'sparring') drawSparringIcon(ctx, middle, top + 22);
      else drawSandbagIcon(ctx, middle, top + 22);
      drawCenteredText(ctx, card.lines[0], middle, top + 50, active ? PALETTE.white : PALETTE.lightGrey);
      drawCenteredText(ctx, card.lines[1], middle, top + 58, PALETTE.lavender);
    });

    drawCenteredText(ctx, 'A/D CHOOSE   ENTER OR J START', CENTER, 110, PALETTE.white);
    drawCenteredText(ctx, 'ESC MENU', CENTER, 119, PALETTE.lavender);
  }
}

/** Two kangaroo heads squaring up, gloves raised. */
function drawSparringIcon(ctx: CanvasRenderingContext2D, centerX: number, top: number): void {
  drawIcon(ctx, HEADS.normal, centerX - 24, top + 2, SKINS.left);
  drawIcon(ctx, GLOVE, centerX - 9, top + 8, SKINS.left);
  drawIcon(ctx, HEADS.normal, centerX + 9, top + 2, SKINS.right, 1, true);
  drawIcon(ctx, GLOVE, centerX + 3, top + 8, SKINS.right, 1, true);
}

/** A kangaroo head next to a little sandbag. */
function drawSandbagIcon(ctx: CanvasRenderingContext2D, centerX: number, top: number): void {
  drawIcon(ctx, HEADS.happy, centerX - 22, top + 4, SKINS.left);
  drawIcon(ctx, GLOVE, centerX - 7, top + 10, SKINS.left);
  ctx.fillStyle = PALETTE.lightGrey;
  ctx.fillRect(centerX + 10, top - 2, 1, 5);
  ctx.fillStyle = '#2b1509';
  ctx.fillRect(centerX + 5, top + 3, 11, 20);
  ctx.fillStyle = '#b8323a';
  ctx.fillRect(centerX + 6, top + 4, 9, 18);
  ctx.fillStyle = '#e2585a';
  ctx.fillRect(centerX + 7, top + 5, 2, 16);
  ctx.fillStyle = '#2b2b3a';
  ctx.fillRect(centerX + 6, top + 7, 9, 2);
  ctx.fillRect(centerX + 6, top + 17, 9, 2);
}
