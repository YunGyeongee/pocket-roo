import { describe, expect, it } from 'vitest';
import { loadOpacity, loadShowBackground, nextOpacity, OPACITY_LEVELS, opacityLabel } from '../src/ui/Transparency';

describe('see-through mode', () => {
  it('cycles through the levels and back to fully visible', () => {
    let opacity = 1;
    const seen = [];
    for (let i = 0; i < OPACITY_LEVELS.length; i++) {
      opacity = nextOpacity(opacity);
      seen.push(opacity);
    }
    expect(seen).toEqual([...OPACITY_LEVELS.slice(1), 1]);
  });

  it('starts over from an unknown level', () => {
    expect(nextOpacity(0.42)).toBe(1);
  });

  it('never goes below a level the window can still be found at', () => {
    expect(Math.min(...OPACITY_LEVELS)).toBeGreaterThanOrEqual(0.2);
  });

  it('labels levels as percentages', () => {
    expect(OPACITY_LEVELS.map(opacityLabel)).toEqual(['100%', '60%', '30%']);
  });

  it('starts fully visible when nothing is saved', () => {
    expect(loadOpacity()).toBe(1);
  });

  it('shows the background unless it was turned off', () => {
    expect(loadShowBackground()).toBe(true);
  });
});
