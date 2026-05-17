import { app, nativeImage } from 'electron';
import * as path from 'path';
import log from 'electron-log';
import { createPetWindow, getPetWindow, setPetWindow } from './window';
import { createTray } from './tray';
import { registerIpcHandlers } from './ipc';
import { startAdapterServer } from './adapter/server';
import { initModelProtocol } from './model-manager';
import { initActionIndex } from './action-index';
import { getTTSManager } from './tts';

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.info('ViviPet starting...');

function resolveAppIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.png')
    : path.join(__dirname, '../../assets/icon.png');
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  app.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection:', reason);
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log.info('Another instance is already running. Quitting...');
  app.quit();
} else {
  app.on('second-instance', () => {
    const petWindow = getPetWindow();
    if (petWindow) {
      if (petWindow.isMinimized()) petWindow.restore();
      petWindow.show();
      petWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  log.info('App is ready');

  try {
    const dockIcon = nativeImage.createFromPath(resolveAppIconPath());
    if (!dockIcon.isEmpty()) {
      app.dock?.setIcon(dockIcon);
      log.info('Dock icon configured');
    } else {
      log.warn('Dock icon image is empty');
    }
  } catch (error) {
    log.warn('Failed to configure dock icon:', error);
  }

  // Initialize custom protocol for user-imported model assets
  initModelProtocol();
  initActionIndex();

  try {
    const petWindow = createPetWindow();
    setPetWindow(petWindow);
    createTray(petWindow);
    registerIpcHandlers();
    getTTSManager().setWindowGetter(getPetWindow);
    startAdapterServer(getPetWindow);

    log.info('ViviPet initialized successfully');
  } catch (error) {
    log.error('Failed to initialize:', error);
    app.exit(1);
  }
});

// Window close is intercepted to hide to tray instead of destroying.
// On all platforms we keep the app alive -- quit only via tray menu.
app.on('window-all-closed', () => {
  log.info('window-all-closed fired (not quitting -- window was hidden to tray)');
});

// Quit ONLY happens via tray menu Quit button (which calls setIsQuitting + app.quit).
// For all other close/quit attempts (Cmd+Q, Cmd+W, system signals):
// - before-quit fires first, but we do nothing here
// - the window's close handler sees !isQuitting → preventDefault + hide
// - the quit is aborted, app stays alive
app.on('before-quit', () => {
  log.info('before-quit fired (will be intercepted if not from tray Quit)');
});

app.on('activate', () => {
  // macOS: if dock icon is clicked (unlikely since dock is hidden),
  // show the existing hidden window instead of creating a new one.
  const petWindow = getPetWindow();
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.show();
  }
});
