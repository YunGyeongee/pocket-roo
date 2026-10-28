import './styles/main.css';
import { DIFFICULTIES } from './game/AIController';
import { GameLoop } from './game/GameLoop';
import { GameModeManager } from './game/GameModeManager';
import type { ModeKind } from './game/GameState';
import { DEFAULT_BINDINGS, InputManager } from './game/InputManager';
import { PunchingBagMode, TIME_ATTACK_SECONDS } from './modes/PunchingBagMode';
import { SparringMode } from './modes/SparringMode';
import { Renderer } from './rendering/Renderer';
import { drawHUD } from './ui/GameHUD';
import { Menu, type MenuAction, type MenuItem } from './ui/Menu';
import { drawMoveList } from './ui/MoveList';
import { ModeSelectMenu } from './ui/ModeSelectMenu';

const api = window.cornerApi;

function element<T extends HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing element ${selector}`);
  return found;
}

const canvas = element<HTMLCanvasElement>('#game');
const stage = element<HTMLElement>('#stage');
const pinButton = element<HTMLButtonElement>('#btn-pin');
const pauseButton = element<HTMLButtonElement>('#btn-pause');
const minimizeButton = element<HTMLButtonElement>('#btn-min');
const closeButton = element<HTMLButtonElement>('#btn-close');

const manager = new GameModeManager();
const renderer = new Renderer(canvas);
const modeSelect = new ModeSelectMenu();
const menu = new Menu();
let pinned = true;
/** The move list page, opened from the pause menu. */
let showMoves = false;
let clock = 0;
let frameDt = 0;

const loop = new GameLoop({ update, render, maxFps: 60 });
// Any key wakes the loop, which sleeps while the pause menu is open.
const input = new InputManager(window, DEFAULT_BINDINGS, () => loop.start());

function update(dt: number): void {
  frameDt = menu.open ? 0 : dt;
  clock += dt;
  const mode = manager.mode;

  if (showMoves) {
    if (input.consumePressed('pause') || input.consumePressed('confirm')) showMoves = false;
  } else if (input.consumePressed('pause')) {
    if (menu.open) resume();
    else pause();
  } else if (menu.open) {
    if (input.consumePressed('up')) menu.move(-1);
    if (input.consumePressed('down')) menu.move(1);
    if (input.consumePressed('confirm')) activate(menu.current);
  } else if (!mode) {
    if (input.consumePressed('left') || input.consumePressed('up')) modeSelect.move(-1);
    if (input.consumePressed('right') || input.consumePressed('down')) modeSelect.move(1);
    if (input.consumePressed('confirm')) start(modeSelect.current);
  } else if (input.consumePressed('restart')) {
    restart();
  } else if (input.consumePressed('variant') && mode instanceof PunchingBagMode) {
    toggleVariant(mode);
  } else {
    manager.update(dt, input.playerIntent());
  }
  renderer.addEvents(manager.mode?.drainEvents() ?? []);
  input.endFrame();

  // Nothing moves while paused, so stop rendering until there is input.
  if (menu.open) loop.stop();
}

function render(): void {
  const mode = manager.mode;
  renderer.render(mode, frameDt, (ctx) => {
    if (mode) drawHUD(ctx, mode, clock);
    else modeSelect.draw(ctx, clock);
    if (menu.open) menu.draw(ctx);
    if (showMoves) drawMoveList(ctx);
  });
}

function start(kind: ModeKind): void {
  manager.enter(kind);
  renderer.effects.clear();
  input.clear();
}

function restart(): void {
  manager.restart();
  renderer.effects.clear();
  resume();
}

function toggleVariant(mode: PunchingBagMode): void {
  mode.variant = mode.variant === 'free' ? 'timeattack' : 'free';
  manager.restart();
  renderer.effects.clear();
}

function menuItems(): MenuItem[] {
  const mode = manager.mode;
  const items: MenuItem[] = [{ action: 'resume', label: () => 'RESUME' }];
  if (mode) items.push({ action: 'restart', label: () => 'RESTART' }, { action: 'moves', label: () => 'MOVE LIST' });
  if (mode instanceof SparringMode) {
    items.push({ action: 'level', label: () => `LEVEL: ${manager.difficulty.toUpperCase()}` });
  }
  if (mode instanceof PunchingBagMode) {
    items.push({ action: 'variant', label: () => `PLAY: ${mode.variant === 'free' ? 'FREE' : `${TIME_ATTACK_SECONDS}S RUN`}` });
  }
  if (mode) items.push({ action: 'select', label: () => 'MODE SELECT' });
  if (api) items.push({ action: 'pin', label: () => `ON TOP: ${pinned ? 'ON' : 'OFF'}` });
  items.push({ action: 'quit', label: () => 'QUIT' });
  return items;
}

function menuHints(): string[] {
  const mode = manager.mode;
  if (mode instanceof SparringMode) return ['A/D MOVE  SPACE BACKSTEP  R RESTART', 'ESC RESUME'];
  if (mode instanceof PunchingBagMode) return ['A/D MOVE  T FREE / TIME ATTACK', 'ESC RESUME'];
  return ['A/D CHOOSE  ENTER START'];
}

function pause(): void {
  if (menu.open) return;
  manager.paused = true;
  menu.show(menuItems(), menuHints());
  input.clear();
  pauseButton.classList.add('active');
  render();
}

function resume(): void {
  manager.paused = false;
  showMoves = false;
  menu.hide();
  pauseButton.classList.remove('active');
  loop.start();
}

function activate(action: MenuAction): void {
  switch (action) {
    case 'resume':
      resume();
      break;
    case 'restart':
      restart();
      break;
    case 'moves':
      showMoves = true;
      render();
      break;
    case 'level':
      manager.setDifficulty(DIFFICULTIES[(DIFFICULTIES.indexOf(manager.difficulty) + 1) % DIFFICULTIES.length]);
      render();
      break;
    case 'variant':
      if (manager.mode instanceof PunchingBagMode) toggleVariant(manager.mode);
      resume();
      break;
    case 'select':
      manager.exitToSelect();
      renderer.effects.clear();
      resume();
      break;
    case 'pin':
      void togglePin();
      break;
    case 'quit':
      quit();
      break;
  }
}

async function togglePin(): Promise<void> {
  if (!api) return;
  pinned = await api.setAlwaysOnTop(!pinned);
  pinButton.classList.toggle('active', pinned);
  render();
}

function quit(): void {
  loop.stop();
  if (api) api.close();
  else window.close();
}

// Mouse: menu items, mode cards and "click to fight again".
canvas.addEventListener('click', (event) => {
  const point = renderer.toWorld(event.clientX, event.clientY);
  if (showMoves) {
    showMoves = false;
    render();
  } else if (menu.open) {
    const index = menu.hitTest(point);
    if (index < 0) return;
    menu.selected = index;
    activate(menu.current);
  } else if (!manager.mode) {
    const index = modeSelect.hitTest(point);
    if (index < 0) return;
    modeSelect.selected = index;
    start(modeSelect.current);
  } else if (!manager.mode.active || (manager.mode instanceof SparringMode && manager.mode.phase === 'over')) {
    restart();
  }
  loop.start();
});

canvas.addEventListener('pointermove', (event) => {
  const point = renderer.toWorld(event.clientX, event.clientY);
  if (menu.open) {
    const index = menu.hitTest(point);
    if (index >= 0 && index !== menu.selected) {
      menu.selected = index;
      render();
    }
  } else if (!manager.mode) {
    const index = modeSelect.hitTest(point);
    if (index >= 0) modeSelect.selected = index;
  }
});

// Title bar buttons. Prevent focus so Space doesn't "click" them again.
for (const button of [pinButton, pauseButton, minimizeButton, closeButton]) {
  button.addEventListener('mousedown', (event) => event.preventDefault());
}
pinButton.addEventListener('click', () => void togglePin());
pauseButton.addEventListener('click', () => (menu.open ? resume() : pause()));
minimizeButton.addEventListener('click', () => api?.minimize());
closeButton.addEventListener('click', quit);
if (!api) {
  pinButton.hidden = true;
  minimizeButton.hidden = true;
}

// Losing focus pauses a fight in progress; the input manager also drops held keys.
window.addEventListener('blur', () => {
  if (manager.mode?.active) pause();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) loop.stop();
  else loop.start();
});

new ResizeObserver(() => {
  renderer.resize();
  render();
}).observe(stage);

input.attach();
if (api) {
  void api.isAlwaysOnTop().then((value) => {
    pinned = value;
    pinButton.classList.toggle('active', pinned);
  });
}
loop.start();
