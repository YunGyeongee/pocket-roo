import type { Intent } from './GameState';

export type Action =
  | 'left'
  | 'right'
  | 'jump'
  | 'crouch'
  | 'punch'
  | 'kick'
  | 'guard'
  | 'dodge'
  | 'pause'
  | 'restart'
  | 'variant'
  | 'opacity'
  | 'background'
  | 'up'
  | 'down'
  | 'confirm';

/** Action -> KeyboardEvent.code values. Change these to remap the controls. */
export type KeyBindings = Record<Action, readonly string[]>;

export const DEFAULT_BINDINGS: KeyBindings = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['KeyW', 'ArrowUp'],
  crouch: ['KeyS', 'ArrowDown'],
  punch: ['KeyJ'],
  kick: ['KeyK'],
  guard: ['KeyL'],
  dodge: ['Space'],
  pause: ['Escape'],
  restart: ['KeyR'],
  variant: ['KeyT'],
  opacity: ['KeyO'],
  background: ['KeyB'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  confirm: ['Enter', 'Space', 'KeyJ'],
};

type InputTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
type KeyLike = Pick<KeyboardEvent, 'code' | 'repeat' | 'preventDefault' | 'metaKey' | 'ctrlKey'>;

export class InputManager {
  private readonly held = new Set<string>();
  /** Actions pressed since the last endFrame(). */
  private readonly pressed = new Set<Action>();
  private codeActions = new Map<string, Action[]>();

  constructor(
    private readonly target: InputTarget,
    bindings: KeyBindings = DEFAULT_BINDINGS,
    private readonly onActivity: () => void = () => {},
  ) {
    this.setBindings(bindings);
  }

  setBindings(bindings: KeyBindings): void {
    this.codeActions = new Map();
    for (const [action, codes] of Object.entries(bindings) as [Action, readonly string[]][]) {
      for (const code of codes) this.codeActions.set(code, [...(this.codeActions.get(code) ?? []), action]);
    }
    this.clear();
  }

  attach(): void {
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.target.addEventListener('blur', this.clear);
  }

  detach(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('blur', this.clear);
  }

  isDown(action: Action): boolean {
    for (const code of this.held) {
      if (this.codeActions.get(code)?.includes(action)) return true;
    }
    return false;
  }

  /** True once per key press. */
  consumePressed(action: Action): boolean {
    return this.pressed.delete(action);
  }

  /** Drops presses nobody consumed this frame, so they don't fire later in a different context. */
  endFrame(): void {
    this.pressed.clear();
  }

  /** Forgets all keys, e.g. when the window loses focus and key-ups would be missed. */
  readonly clear = (): void => {
    this.held.clear();
    this.pressed.clear();
  };

  /** Jumps, attacks and dodges fire once per key press; holding the key doesn't repeat them. */
  playerIntent(): Intent {
    const move = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    return {
      move,
      crouch: this.isDown('crouch'),
      jump: this.consumePressed('jump'),
      punch: this.consumePressed('punch'),
      kick: this.consumePressed('kick'),
      dodge: this.consumePressed('dodge'),
      guard: this.isDown('guard'),
    };
  }

  private readonly handleKeyDown = (event: Event): void => {
    const key = event as unknown as KeyLike;
    // Leave system shortcuts such as Cmd+Q alone.
    if (key.metaKey || key.ctrlKey) return;
    const actions = this.codeActions.get(key.code);
    if (!actions) return;
    key.preventDefault();
    this.held.add(key.code);
    if (!key.repeat) for (const action of actions) this.pressed.add(action);
    this.onActivity();
  };

  private readonly handleKeyUp = (event: Event): void => {
    this.held.delete((event as unknown as KeyLike).code);
  };
}
