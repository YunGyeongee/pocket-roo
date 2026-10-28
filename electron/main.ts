import { app, BrowserWindow, ipcMain, protocol, screen, session, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const WINDOW_WIDTH = 480;
const WINDOW_HEIGHT = 300;
const MIN_WIDTH = 360;
const MIN_HEIGHT = 240;
const SCREEN_MARGIN = 16;
// Height of the HTML drag bar above the canvas; kept out of the aspect ratio.
const TITLEBAR_HEIGHT = 20;
// Logical game resolution (see src/entities/Arena.ts).
const GAME_ASPECT = 240 / 140;

// The built page is served from app://game/ rather than file://, so it gets a normal web origin
// and needs no extra file:// privileges (that fuse is turned off in the packaged app).
const APP_SCHEME = 'app';
const APP_HOST = 'game';
const DIST_ROOT = path.join(__dirname, '../dist');
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

protocol.registerSchemesAsPrivileged([{ scheme: APP_SCHEME, privileges: { standard: true, secure: true } }]);

async function serveAppFile(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const filePath = path.join(DIST_ROOT, path.normalize(decodeURIComponent(url.pathname)));
  const relative = path.relative(DIST_ROOT, filePath);
  // Never serve anything outside dist/.
  if (url.host !== APP_HOST || relative.startsWith('..') || path.isAbsolute(relative)) {
    return new Response('Not found', { status: 404 });
  }
  try {
    const body = await readFile(filePath);
    const type = CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream';
    return new Response(body, { headers: { 'content-type': type } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

// A packaged app must never be pointed at another page through the environment.
const devServerUrl = app.isPackaged ? undefined : process.env.VITE_DEV_SERVER_URL;
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const { workArea } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    // Start in the bottom-right corner of the screen.
    x: workArea.x + workArea.width - WINDOW_WIDTH - SCREEN_MARGIN,
    y: workArea.y + workArea.height - WINDOW_HEIGHT - SCREEN_MARGIN,
    frame: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    show: false,
    // Always transparent: the page paints its own background, and can leave it out so only
    // the ring and the players float over the desktop. Must be set when the window is created.
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  mainWindow = win;

  win.setAlwaysOnTop(true, 'floating');
  if (process.platform === 'darwin') {
    win.setAspectRatio(GAME_ASPECT, { width: 0, height: TITLEBAR_HEIGHT });
  } else {
    // extraSize is macOS-only; keep the default window proportions instead.
    win.setAspectRatio(WINDOW_WIDTH / WINDOW_HEIGHT);
  }
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    mainWindow = null;
  });

  // The game never opens other pages.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());

  void win.loadURL(devServerUrl ?? `${APP_SCHEME}://${APP_HOST}/index.html`);

  const capturePath = process.env.CK_CAPTURE_PATH;
  if (capturePath && !app.isPackaged) {
    scheduleDebugCapture(win, capturePath);
  }
}

// Dev-only: optionally press keys, save a screenshot and quit. Used to check rendering from scripts.
// CK_CAPTURE_KEYS is a comma list: "KeyJ" taps a key, "+KeyD"/"-KeyD" holds/releases one, "~300" waits 300ms.
function scheduleDebugCapture(win: BrowserWindow, file: string): void {
  const steps = process.env.CK_CAPTURE_KEYS?.split(',').filter(Boolean) ?? [];
  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
  win.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      // A window launched from a script may not get keyboard focus on its own.
      win.focus();
      win.webContents.focus();
      for (const step of steps) {
        if (step.startsWith('~')) {
          await wait(Number(step.slice(1)));
        } else if (step.startsWith('+')) {
          win.webContents.sendInputEvent({ type: 'keyDown', keyCode: step.slice(1) });
        } else if (step.startsWith('-')) {
          win.webContents.sendInputEvent({ type: 'keyUp', keyCode: step.slice(1) });
        } else {
          win.webContents.sendInputEvent({ type: 'keyDown', keyCode: step });
          win.webContents.sendInputEvent({ type: 'keyUp', keyCode: step });
          await wait(150);
        }
      }
      const image = await win.webContents.capturePage();
      await writeFile(file, image.toPNG());
      app.quit();
    }, 1500);
  });
}

/** Only accept IPC from the top-level page of our own window. */
function senderWindow(event: IpcMainEvent | IpcMainInvokeEvent): BrowserWindow | null {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win !== mainWindow) return null;
  return event.senderFrame === win.webContents.mainFrame ? win : null;
}

ipcMain.handle('window:is-always-on-top', (event) => senderWindow(event)?.isAlwaysOnTop() ?? false);

ipcMain.handle('window:set-always-on-top', (event, value: unknown) => {
  const win = senderWindow(event);
  if (!win || typeof value !== 'boolean') return false;
  win.setAlwaysOnTop(value, 'floating');
  return win.isAlwaysOnTop();
});

// See-through mode. Never fully invisible, so the window can always be found again.
const MIN_OPACITY = 0.2;

ipcMain.handle('window:set-opacity', (event, value: unknown) => {
  const win = senderWindow(event);
  if (!win || typeof value !== 'number' || !Number.isFinite(value)) return 1;
  win.setOpacity(Math.min(1, Math.max(MIN_OPACITY, value)));
  return win.getOpacity();
});

ipcMain.on('window:minimize', (event) => senderWindow(event)?.minimize());
ipcMain.on('window:close', (event) => senderWindow(event)?.close());

// Groups the taskbar button under the app's own identity on Windows.
if (process.platform === 'win32') app.setAppUserModelId('com.pocketroo.app');

app.whenReady().then(() => {
  // The game needs no camera, microphone, notifications, etc. Electron grants them by default.
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  protocol.handle(APP_SCHEME, serveAppFile);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// A corner mini game has no reason to linger without its window.
app.on('window-all-closed', () => app.quit());
