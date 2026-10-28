import { describe, expect, it } from 'vitest';
import { ATTACKS } from '../src/game/CombatBalance';
import { BODY_DOWN, FONT, GLOVE, GLOVE_SIZE, GLYPH_HEIGHT, GLYPH_WIDTH, HEADS, LAYER_OFFSETS, LEGS, SKINS, TORSO, textWidth } from '../src/rendering/PixelAssets';

const SPRITES = { ...HEADS, ...LEGS, TORSO, BODY_DOWN, GLOVE };

describe('PixelAssets', () => {
  it('only uses letters that every skin has a color for', () => {
    for (const [name, sprite] of Object.entries(SPRITES)) {
      for (const row of sprite) {
        for (const code of row) {
          if (code === '.') continue;
          for (const skin of Object.values(SKINS)) expect(skin[code as keyof typeof skin], `${name}: ${code}`).toBeDefined();
        }
      }
    }
  });

  it('keeps head variants the same shape so expressions swap cleanly', () => {
    for (const head of Object.values(HEADS)) expect(head.length).toBe(HEADS.normal.length);
  });

  it('has a square glove', () => {
    expect(GLOVE.length).toBe(GLOVE_SIZE);
    for (const row of GLOVE) expect(row.length).toBe(GLOVE_SIZE);
  });

  it('draws the kicking foot about as far out as the kick reaches', () => {
    const footTip = LAYER_OFFSETS.legs.kick.x + Math.max(...LEGS.kick.map((row) => row.length));
    expect(Math.abs(footTip - ATTACKS.kick.reachEnd)).toBeLessThanOrEqual(3);
  });

  it('has glyphs for every letter and digit within the 3x5 grid', () => {
    for (const char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+:-!./,') {
      expect(FONT[char], char).toBeDefined();
      for (const [x, y] of FONT[char]) {
        expect(x).toBeLessThan(GLYPH_WIDTH);
        expect(y).toBeLessThan(GLYPH_HEIGHT);
      }
    }
  });

  it('measures text', () => {
    expect(textWidth('')).toBe(0);
    expect(textWidth('A')).toBe(3);
    expect(textWidth('AB', 2)).toBe(14);
  });
});
