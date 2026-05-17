import { Tray, Menu, nativeImage, BrowserWindow, app, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import log from 'electron-log';
import { setIsQuitting } from './app-state';
import { getTTSManager } from './tts';

let tray: Tray | null = null;
let currentPetWindow: BrowserWindow | null = null;
let modelNames: string[] = [];
let currentModelIndex = 0;

/** Send an action event to the renderer process. */
function sendAction(action: string): void {
  currentPetWindow?.webContents.send('pet:action', action);
}

/** Build the TTS submenu items (inline, no nesting to keep click handling simple). */
function buildTTSSubmenu(): MenuItemConstructorOptions[] {
  const tts = getTTSManager();
  const config = tts.getConfig();

  const sourceLabels: Record<string, string> = {
    none: 'Disabled',
    system: 'System (macOS)',
    local: 'Local Service',
    cloud: 'Cloud API',
  };

  const items: MenuItemConstructorOptions[] = [];

  // TTS enable/disable toggle
  items.push({
    label: 'Enable TTS',
    type: 'checkbox',
    checked: config.enabled,
    click: (menuItem) => {
      const newEnabled = menuItem.checked;
      tts.setConfig({ enabled: newEnabled });
      if (newEnabled && config.source === 'none') {
        // 启用时若 source 为 none，自动切到 system
        tts.setConfig({ source: 'system' });
      }
      if (tray) tray.setContextMenu(buildTrayMenu());
      log.info(`[Tray] TTS ${newEnabled ? 'enabled' : 'disabled'}`);
    },
  });

  // Source selection
  const sources = ['none', 'system', 'local', 'cloud'] as const;
  items.push({
    label: 'Source',
    submenu: sources.map((src) => ({
      label: sourceLabels[src],
      type: 'radio' as const,
      checked: config.source === src,
      click: () => {
        tts.setConfig({ source: src, enabled: src !== 'none' });
        if (tray) tray.setContextMenu(buildTrayMenu());
        log.info(`[Tray] TTS source: ${src}`);
      },
    })),
  });

  // 状态信息
  if (config.enabled && config.source === 'system') {
    const voice = config.system?.voice || 'default';
    items.push({ type: 'separator' });
    items.push({
      label: `Voice: ${voice}`,
      enabled: false,
    });
  }

  return items;
}

/** Build the full tray context menu with current model list. */
function buildTrayMenu(): Menu {
  // Base items
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Show/Hide',
      click: () => {
        const win = currentPetWindow;
        if (!win) return;
        if (win.isVisible()) {
          win.hide();
          app.dock?.hide();
        } else {
          win.show();
          app.dock?.show();
        }
      },
    },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: true,
      click: (menuItem) => {
        currentPetWindow?.setAlwaysOnTop(menuItem.checked);
      },
    },
    {
      label: 'Mouse Passthrough',
      type: 'checkbox',
      checked: false,
      click: (menuItem) => sendAction(menuItem.checked ? 'mousePassthrough:on' : 'mousePassthrough:off'),
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => sendAction('settings'),
    },
    {
      label: 'Size',
      submenu: [
        { label: 'Small', click: () => sendAction('resizePet:0.7') },
        { label: 'Medium', click: () => sendAction('resizePet:1.0') },
        { label: 'Large', click: () => sendAction('resizePet:1.3') },
      ],
    },
    {
      label: 'Mouse Follow',
      type: 'checkbox',
      checked: true,
      click: (menuItem) => sendAction(menuItem.checked ? 'mouseFollow:on' : 'mouseFollow:off'),
    },
    { type: 'separator' },
    ...buildTTSSubmenu(),
    { type: 'separator' },
    {
      label: 'Import Model...',
      click: () => sendAction('importModel'),
    },
    { type: 'separator' },
  ];

  // Switch Model submenu (dynamic)
  if (modelNames.length > 0) {
    const modelItems: MenuItemConstructorOptions[] = modelNames.map((name, index) => ({
      label: name,
      type: 'radio',
      checked: index === currentModelIndex,
      click: () => sendAction(`model:${index}`),
    }));
    template.push({ label: 'Switch Model', submenu: modelItems });
    template.push({ type: 'separator' });
  }

  template.push({
    label: 'Quit',
    click: () => {
      setIsQuitting(true);
      app.quit();
    },
  });

  return Menu.buildFromTemplate(template);
}

export function createTray(petWindow: BrowserWindow): Tray {
  currentPetWindow = petWindow;
  const trayIcon = loadTrayIcon();

  tray = new Tray(trayIcon);
  tray.setToolTip('ViviPet');
  tray.setContextMenu(buildTrayMenu());

  // Double-click to show/hide
  tray.on('double-click', () => {
    if (petWindow.isVisible()) {
      petWindow.hide();
      app.dock?.hide();
    } else {
      petWindow.show();
      app.dock?.show();
    }
  });

  log.info('System tray created');
  return tray;
}

/**
 * Update the model list shown in the tray's Switch Model submenu.
 * Called from renderer when models are loaded or changed.
 */
export function updateTrayModelNames(names: string[]): void {
  modelNames = names;
  currentModelIndex = Math.min(currentModelIndex, Math.max(0, names.length - 1));
  if (tray) {
    tray.setContextMenu(buildTrayMenu());
    log.info(`Tray menu updated with ${names.length} model(s)`);
  }
}

/** Update the checked model in the tray's Switch Model submenu. */
export function updateTrayCurrentModel(index: number): void {
  currentModelIndex = Number.isFinite(index)
    ? Math.max(0, Math.min(Math.trunc(index), Math.max(0, modelNames.length - 1)))
    : 0;
  if (tray) {
    tray.setContextMenu(buildTrayMenu());
    log.info(`Tray current model updated: ${currentModelIndex}`);
  }
}

/**
 * Load the tray icon.
 * - On macOS: use a native SF Symbol template image so the menu bar icon
 *   matches the historical Electron behavior and avoids colored/boxed edges.
 * - On Windows/Linux: load from the app assets.
 */
function loadTrayIcon(): Electron.NativeImage {
  if (process.platform === 'darwin') {
    const icon = nativeImage.createFromNamedImage('v.circle.fill');
    if (!icon || icon.isEmpty()) {
      log.warn('SF Symbol v.circle.fill not available, falling back to star.fill');
      const fallback = nativeImage.createFromNamedImage('star.fill');
      const sized = fallback.resize({ width: 18, height: 18 });
      sized.setTemplateImage(true);
      return sized;
    }

    const sized = icon.resize({ width: 18, height: 18 });
    sized.setTemplateImage(true);
    log.info('Tray icon: SF Symbol v.circle.fill');
    return sized;
  }

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.png')
    : path.join(__dirname, '../../assets/icon.png');

  try {
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      const sized = icon.resize({ width: 18, height: 18 });
      log.info(`Tray icon loaded from file: ${iconPath}`);
      return sized;
    }
  } catch (err) {
    log.warn('Failed to load tray icon from file:', err);
  }

  // Fallback: solid white circle
  const S = 18;
  const buf = Buffer.alloc(S * S * 4, 0);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x - 9, dy = y - 9;
      if (dx * dx + dy * dy <= 7 * 7) {
        const i = (y * S + x) * 4;
        buf[i] = 255; buf[i + 1] = 255; buf[i + 2] = 255; buf[i + 3] = 255;
      }
    }
  }
  return nativeImage.createFromBuffer(buf, { width: S, height: S });
}

export function getTray(): Tray | null {
  return tray;
}
