import { describe, expect, it } from 'vitest';
import { IDLE_INTENT } from '../src/game/GameState';
import { DEFAULT_BINDINGS, InputManager } from '../src/game/InputManager';

function key(type: 'keydown' | 'keyup', code: string, extra: { repeat?: boolean; metaKey?: boolean } = {}): Event {
  return Object.assign(new Event(type, { cancelable: true }), { code, repeat: false, metaKey: false, ctrlKey: false, ...extra });
}

function setup() {
  const target = new EventTarget();
  const input = new InputManager(target);
  input.attach();
  return { target, input };
}

describe('InputManager', () => {
  it('maps held keys to movement', () => {
    const { target, input } = setup();
    target.dispatchEvent(key('keydown', 'KeyD'));
    expect(input.playerIntent().move).toBe(1);
    target.dispatchEvent(key('keydown', 'KeyA'));
    expect(input.playerIntent().move).toBe(0);
    target.dispatchEvent(key('keyup', 'KeyD'));
    expect(input.playerIntent().move).toBe(-1);
  });

  it('reports attacks once per press and ignores key repeat', () => {
    const { target, input } = setup();
    target.dispatchEvent(key('keydown', 'KeyJ'));
    expect(input.playerIntent().punch).toBe(true);
    expect(input.playerIntent().punch).toBe(false);
    target.dispatchEvent(key('keydown', 'KeyJ', { repeat: true }));
    target.dispatchEvent(key('keydown', 'KeyK', { repeat: true }));
    expect(input.playerIntent()).toMatchObject({ punch: false, kick: false });
  });

  it('holds the guard while L is down and dodges once per Space press', () => {
    const { target, input } = setup();
    target.dispatchEvent(key('keydown', 'KeyL'));
    target.dispatchEvent(key('keydown', 'Space'));
    expect(input.playerIntent()).toMatchObject({ guard: true, dodge: true });
    expect(input.playerIntent()).toMatchObject({ guard: true, dodge: false });
    target.dispatchEvent(key('keyup', 'KeyL'));
    expect(input.playerIntent().guard).toBe(false);
  });

  it('drops unconsumed presses at the end of the frame', () => {
    const { target, input } = setup();
    target.dispatchEvent(key('keydown', 'KeyK'));
    input.endFrame();
    expect(input.consumePressed('kick')).toBe(false);
  });

  it('releases every key when the window loses focus', () => {
    const { target, input } = setup();
    target.dispatchEvent(key('keydown', 'KeyA'));
    target.dispatchEvent(key('keydown', 'KeyL'));
    target.dispatchEvent(key('keydown', 'KeyJ'));
    target.dispatchEvent(new Event('blur'));
    expect(input.isDown('left')).toBe(false);
    expect(input.playerIntent()).toEqual(IDLE_INTENT);
  });

  it('prevents the default action for bound keys only', () => {
    const { target } = setup();
    const bound = key('keydown', 'Space');
    const unbound = key('keydown', 'KeyQ');
    target.dispatchEvent(bound);
    target.dispatchEvent(unbound);
    expect(bound.defaultPrevented).toBe(true);
    expect(unbound.defaultPrevented).toBe(false);
  });

  it('leaves system shortcuts alone', () => {
    const { target, input } = setup();
    target.dispatchEvent(key('keydown', 'KeyR', { metaKey: true }));
    expect(input.consumePressed('restart')).toBe(false);
  });

  it('supports custom bindings', () => {
    const target = new EventTarget();
    const input = new InputManager(target, {
      ...DEFAULT_BINDINGS,
      left: ['KeyJ'], right: ['KeyL'], punch: ['KeyZ'], kick: ['KeyX'], guard: ['KeyC'], dodge: ['KeyV'],
    });
    input.attach();
    target.dispatchEvent(key('keydown', 'KeyJ'));
    target.dispatchEvent(key('keydown', 'KeyX'));
    expect(input.playerIntent()).toEqual({ ...IDLE_INTENT, move: -1, kick: true });
    input.detach();
    target.dispatchEvent(key('keydown', 'KeyL'));
    expect(input.isDown('right')).toBe(false);
  });
});
