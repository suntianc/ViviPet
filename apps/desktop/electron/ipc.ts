import { ipcMain, screen } from 'electron';
import log from 'electron-log';
import { getPetWindow } from './window';
import { updateTrayCurrentModel, updateTrayModelNames } from './tray';
import { importModelViaDialog, indexBundledModels, listUserModels } from './model-manager';
import { getCurrentModelId, listModelActions, setCurrentModelId } from './action-index';
import { getTTSManager, TTSConfig, TTSSpeakOptions } from './tts';

let dragSession: {
  pointerX: number;
  pointerY: number;
  windowX: number;
  windowY: number;
} | null = null;

export function registerIpcHandlers(): void {
  // Pet window handlers
  ipcMain.on('pet:window:setIgnoreMouseEvents', (_event, ignore: boolean, options?: { forward: boolean }) => {
    const win = getPetWindow();
    if (win) {
      win.setIgnoreMouseEvents(ignore, options);
      log.info(`Passthrough mode: ${ignore}`);
    }
  });

  ipcMain.on('pet:window:beginDrag', () => {
    const win = getPetWindow();
    if (!win) return;

    const [windowX, windowY] = win.getPosition();
    const pointer = screen.getCursorScreenPoint();
    dragSession = {
      pointerX: pointer.x,
      pointerY: pointer.y,
      windowX,
      windowY,
    };
  });

  ipcMain.on('pet:window:dragToCursor', () => {
    const win = getPetWindow();
    if (!win || !dragSession) return;

    const pointer = screen.getCursorScreenPoint();
    win.setPosition(
      Math.round(dragSession.windowX + pointer.x - dragSession.pointerX),
      Math.round(dragSession.windowY + pointer.y - dragSession.pointerY),
    );
  });

  ipcMain.on('pet:window:endDrag', () => {
    dragSession = null;
  });

  ipcMain.handle('pet:window:getPosition', () => {
    const win = getPetWindow();
    if (win) {
      const [x, y] = win.getPosition();
      return { x, y };
    }
    return { x: 0, y: 0 };
  });

  ipcMain.handle('pet:window:getCursorScreenPoint', () => {
    return screen.getCursorScreenPoint();
  });

  ipcMain.on('pet:window:setSize', (_event, width: number, height: number) => {
    const win = getPetWindow();
    if (!win) return;

    const nextWidth = Math.max(1, Math.round(width));
    const nextHeight = Math.max(1, Math.round(height));
    const bounds = win.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = display.workArea;

    const x = Math.min(
      Math.max(bounds.x + Math.round((bounds.width - nextWidth) / 2), areaX),
      areaX + areaWidth - nextWidth,
    );
    const y = Math.min(Math.max(bounds.y + bounds.height - nextHeight, areaY), areaY + areaHeight - nextHeight);

    win.setBounds({ x, y, width: nextWidth, height: nextHeight });
  });

  // Simple resize that keeps bottom-right anchored
  ipcMain.on('pet:window:setSizeAnchored', (_event, width: number, height: number) => {
    const win = getPetWindow();
    if (!win) return;
    const bounds = win.getBounds();
    const x = bounds.x + bounds.width - width;
    const y = bounds.y + bounds.height - height;
    win.setBounds({ x, y, width: Math.round(width), height: Math.round(height) });
  });

  // ---- Tray model list sync ----
  ipcMain.on('pet:tray:updateModelNames', (_event, names: string[]) => {
    updateTrayModelNames(names);
  });

  ipcMain.on('pet:tray:updateCurrentModel', (_event, index: number) => {
    updateTrayCurrentModel(index);
  });

  // ---- Model management ----
  ipcMain.handle('pet:model:import', async () => {
    return importModelViaDialog();
  });

  ipcMain.handle('pet:model:listUserModels', async () => {
    return listUserModels();
  });

  ipcMain.handle('pet:model:indexBundledModels', async (_event, models: Array<{ id: string; name: string; path: string }>) => {
    indexBundledModels(models);
  });

  ipcMain.handle('pet:model:setCurrent', async (_event, modelId: string) => {
    setCurrentModelId(modelId);
  });

  ipcMain.handle('pet:model:listActions', async (_event, modelId?: string) => {
    return listModelActions(modelId || getCurrentModelId());
  });

  // ---- TTS ----
  const ttsManager = getTTSManager();

  ipcMain.handle('pet:tts:speak', async (_event, text: string, options?: TTSSpeakOptions) => {
    try {
      const config = ttsManager.getConfig();
      if (!text?.trim()) {
        return { ok: false, error: 'Empty TTS text' };
      }
      if (!config.enabled || config.source === 'none') {
        return { ok: false, error: 'TTS is disabled' };
      }
      const requestId = await ttsManager.speak(text, options);
      if (!requestId) {
        return { ok: false, error: 'TTS request was not queued' };
      }
      return { ok: true, requestId };
    } catch (err) {
      log.error('[IPC] TTS speak error:', err);
      return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  ipcMain.on('pet:tts:stop', () => {
    ttsManager.stop();
  });

  ipcMain.handle('pet:tts:getConfig', () => {
    return ttsManager.getConfig();
  });

  ipcMain.handle('pet:tts:setConfig', (_event, config: Partial<TTSConfig>) => {
    return ttsManager.setConfig(config);
  });

  ipcMain.handle('pet:tts:resetConfig', () => {
    return ttsManager.resetConfig();
  });

  ipcMain.handle('pet:tts:getVoices', async () => {
    // macOS: 使用 `say -v '?'` 列出可用语音
    try {
      const { execSync } = await import('child_process');
      const output = execSync('say -v "?"', { encoding: 'utf8', timeout: 5000 });
      const voices = output
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split(/\s{2,}/);
          return {
            name: parts[0]?.trim() || '',
            language: parts[1]?.split('#')[1]?.trim() || parts[1]?.trim() || '',
          };
        })
        .filter(v => v.name);
      return voices;
    } catch {
      return [];
    }
  });

  log.info('IPC handlers registered');
}
