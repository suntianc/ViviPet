import { BrowserWindow, screen, app } from 'electron';
import * as path from 'path';
import log from 'electron-log';
import { getIsQuitting } from './app-state';

let petWindow: BrowserWindow | null = null;

function resolveWindowIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.png')
    : path.join(__dirname, '../../assets/icon.png');
}

export function createPetWindow(): BrowserWindow {
  const { x, y, width, height } = screen.getPrimaryDisplay().bounds;

  petWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    focusable: true,
    icon: resolveWindowIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  petWindow.webContents.on('did-finish-load', () => {
    log.info('Pet window loaded successfully');
  });

  // Capture renderer console logs
  petWindow.webContents.on('console-message', (_event, level, message) => {
    const levels = ['verbose', 'info', 'warn', 'error'];
    const levelName = levels[level] || 'unknown';
    log.info(`[Renderer ${levelName}] ${message}`);
  });

  // Load the app
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    petWindow.loadURL('http://localhost:5173');
    petWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    petWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  petWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    log.error(`Failed to load: ${errorCode} - ${errorDescription}`);
  });

  // Intercept close: hide to tray instead of destroying the window.
  // Only allow actual close when the app is quitting via tray menu.
  // On macOS, hiding the window also hides the Dock icon (removes the white dot).
  petWindow.on('close', (event) => {
    if (!getIsQuitting()) {
      event.preventDefault();
      petWindow?.hide();
      app.dock?.hide(); // Remove Dock indicator - app still runs with tray
      log.info('Window hidden to tray (close intercepted)');
    }
  });

  petWindow.on('closed', () => {
    petWindow = null;
  });

  petWindow.setVisibleOnAllWorkspaces(true);

  log.info('Pet window created');
  return petWindow;
}

export function getPetWindow(): BrowserWindow | null {
  return petWindow;
}

export function setPetWindow(win: BrowserWindow): void {
  petWindow = win;
}
