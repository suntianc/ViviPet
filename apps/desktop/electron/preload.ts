import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Types for the exposed API
export interface PetWindowAPI {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
  beginDrag: () => void;
  dragToCursor: () => void;
  endDrag: () => void;
  getPosition: () => Promise<{ x: number; y: number }>;
  getCursorScreenPoint: () => Promise<{ x: number; y: number }>;
  setSize: (width: number, height: number) => void;
  setModelNames: (names: string[]) => void;
  setCurrentModelIndex: (index: number) => void;
  setSizeAnchored: (width: number, height: number) => void;
}

export interface PetModelAPI {
  import: () => Promise<{
    id: string;
    name: string;
    path: string;
    window?: { width: number; height: number };
    actions?: Record<string, unknown>;
  } | null>;
  listUserModels: () => Promise<Array<{
    id: string;
    name: string;
    path: string;
    window?: { width: number; height: number };
    actions?: Record<string, unknown>;
  }>>;
  indexBundledModels: (models: Array<{ id: string; name: string; path: string }>) => Promise<void>;
  setCurrent: (modelId: string) => Promise<void>;
  listActions: (modelId?: string) => Promise<unknown[]>;
}

export interface ElectronAPI {
  petWindow: PetWindowAPI;
  petModel: PetModelAPI;
  petTTS: PetTTSAPI;
  onPetAction: (callback: (action: string, params?: unknown) => void) => () => void;
}

/** TTS API exposed to renderer */
export interface PetTTSAPI {
  speak: (text: string, options?: unknown) => Promise<{ ok: boolean; error?: string }>;
  stop: () => void;
  getConfig: () => Promise<unknown>;
  setConfig: (config: unknown) => unknown;
  resetConfig: () => unknown;
  getVoices: () => Promise<Array<{ name: string; language: string }>>;
  onTTSState: (callback: (state: unknown) => void) => () => void;
  onTTSAudioChunk: (callback: (chunk: unknown) => void) => () => void;
  onTTSConfig: (callback: (config: unknown) => void) => () => void;
}

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Pet window controls
  petWindow: {
    setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) =>
      ipcRenderer.send('pet:window:setIgnoreMouseEvents', ignore, options),
    beginDrag: () => ipcRenderer.send('pet:window:beginDrag'),
    dragToCursor: () => ipcRenderer.send('pet:window:dragToCursor'),
    endDrag: () => ipcRenderer.send('pet:window:endDrag'),
    getPosition: () => ipcRenderer.invoke('pet:window:getPosition'),
    getCursorScreenPoint: () => ipcRenderer.invoke('pet:window:getCursorScreenPoint'),
    setSize: (width: number, height: number) => ipcRenderer.send('pet:window:setSize', width, height),
    setModelNames: (names: string[]) => ipcRenderer.send('pet:tray:updateModelNames', names),
    setCurrentModelIndex: (index: number) => ipcRenderer.send('pet:tray:updateCurrentModel', index),
    setSizeAnchored: (width: number, height: number) => ipcRenderer.send('pet:window:setSizeAnchored', width, height),
  },

  // Pet action triggers (from renderer to main)
  onPetAction: (callback: (action: string, params?: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, action: string, params?: unknown) => callback(action, params);
    ipcRenderer.on('pet:action', handler);
    return () => ipcRenderer.removeListener('pet:action', handler);
  },

  // Model management
  petModel: {
    import: () => ipcRenderer.invoke('pet:model:import'),
    listUserModels: () => ipcRenderer.invoke('pet:model:listUserModels'),
    indexBundledModels: (models: Array<{ id: string; name: string; path: string }>) =>
      ipcRenderer.invoke('pet:model:indexBundledModels', models),
    setCurrent: (modelId: string) => ipcRenderer.invoke('pet:model:setCurrent', modelId),
    listActions: (modelId?: string) => ipcRenderer.invoke('pet:model:listActions', modelId),
  },

  // TTS
  petTTS: {
    speak: (text: string, options?: unknown) => ipcRenderer.invoke('pet:tts:speak', text, options),
    stop: () => ipcRenderer.send('pet:tts:stop'),
    getConfig: () => ipcRenderer.invoke('pet:tts:getConfig'),
    setConfig: (config: unknown) => ipcRenderer.invoke('pet:tts:setConfig', config),
    resetConfig: () => ipcRenderer.invoke('pet:tts:resetConfig'),
    getVoices: () => ipcRenderer.invoke('pet:tts:getVoices'),
    onTTSState: (callback: (state: unknown) => void) => {
      const handler = (_event: IpcRendererEvent, state: unknown) => callback(state);
      ipcRenderer.on('pet:tts:state', handler);
      return () => ipcRenderer.removeListener('pet:tts:state', handler);
    },
    onTTSAudioChunk: (callback: (chunk: unknown) => void) => {
      const handler = (_event: IpcRendererEvent, chunk: unknown) => callback(chunk);
      ipcRenderer.on('pet:tts:audioChunk', handler);
      return () => ipcRenderer.removeListener('pet:tts:audioChunk', handler);
    },
    onTTSConfig: (callback: (config: unknown) => void) => {
      const handler = (_event: IpcRendererEvent, config: unknown) => callback(config);
      ipcRenderer.on('pet:tts:config', handler);
      return () => ipcRenderer.removeListener('pet:tts:config', handler);
    },
  },
} as ElectronAPI);

// Declare global type
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
