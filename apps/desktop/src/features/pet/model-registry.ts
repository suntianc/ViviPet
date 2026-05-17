export interface ModelConfig {
  id: string;
  name: string;
  path: string;
  window?: {
    width: number;
    height: number;
  };
  canvas?: {
    width: number;
    height: number;
  };
  actions?: Record<string, ModelActionConfig>;
  capabilities?: ModelCapabilities;
}

export interface ModelCapabilities {
  expressions?: Record<string, string | null>;
  props?: Record<string, ModelPropCapability>;
  propFallbacks?: Record<string, string[]>;
}

export interface ModelPropCapability {
  enable?: Record<string, number>;
  disable?: Record<string, number>;
}

export interface ModelActionConfig {
  motion?: {
    group: string;
    index?: number;
    file?: string;
  };
  expression?: string;
  expressionFile?: string;
  resetExpressionAfterMs?: number;
}

interface ModelRegistryFile {
  models?: ModelConfig[];
}

export const FALLBACK_MODELS: ModelConfig[] = [
  {
    id: 'jian',
    name: 'Jian',
    path: 'models/Jian/Jian.model3.json',
    window: { width: 1000, height: 900 },
    canvas: { width: 1000, height: 900 },
    actions: {
      idle: { motion: { group: 'Idle', index: 0 } },
      thinking: { motion: { group: 'Shy', index: 0 } },
      reading: { motion: { group: 'Idle', index: 0 } },
      searching: { motion: { group: 'Shy', index: 0 } },
      coding: { motion: { group: 'Idle', index: 0 } },
      terminal: { motion: { group: 'Greeting', index: 0 } },
      testing: { motion: { group: 'Idle', index: 0 } },
      waiting_user: { motion: { group: 'Idle', index: 0 } },
      speaking: { motion: { group: 'Idle', index: 0 } },
      success: { motion: { group: 'Happy', index: 0 } },
      happy: { motion: { group: 'Happy', index: 0 } },
      error: { motion: { group: 'Angry', index: 0 } },
      clicked: { motion: { group: 'Greeting', index: 0 } },
      doubleClicked: { motion: { group: 'Happy', index: 0 } },
      dragging: { motion: { group: 'Idle', index: 0 } },
    },
    capabilities: {
      expressions: {
        neutral: null,
        focused: null,
        happy: 'smile',
        angry: 'angry',
        confused: 'shy',
        worried: 'sad',
        surprised: 'surprised',
        sad: 'sad',
      },
    },
  },
];

const MODEL_REGISTRY_PATH = 'assets/models/models.json';

function resolvePublicAsset(path: string): string {
  const cleanPath = path.replace(/^\.\//, '').replace(/^\//, '');
  return window.location.protocol === 'file:' ? `./${cleanPath}` : `/${cleanPath}`;
}

function isValidModelConfig(model: Partial<ModelConfig>): model is ModelConfig {
  return Boolean(model.id && model.name && model.path);
}

export function getModelWindowSize(model: ModelConfig): { width: number; height: number } {
  return model.window ?? model.canvas ?? { width: 520, height: 760 };
}

export function getModelCanvasSize(model: ModelConfig): { width: number; height: number } {
  return model.canvas ?? model.window ?? { width: 520, height: 760 };
}

export async function loadModelConfigs(): Promise<ModelConfig[]> {
  // 1. Load built-in models from the bundled registry
  let builtIn: ModelConfig[] = [];
  try {
    const response = await fetch(resolvePublicAsset(MODEL_REGISTRY_PATH), { cache: 'no-cache' });
    if (response.ok) {
      const registry = await response.json() as ModelRegistryFile;
      builtIn = (registry.models ?? []).filter(isValidModelConfig);
    }
  } catch (err) {
    console.warn('[ModelRegistry] Failed to load model registry:', err);
  }

  if (builtIn.length === 0) {
    console.warn('[ModelRegistry] No built-in models, using fallback');
    builtIn = FALLBACK_MODELS;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (window as any).electronAPI?.petModel?.indexBundledModels?.(
      builtIn.map((model) => ({ id: model.id, name: model.name, path: model.path })),
    );
  } catch (err) {
    console.warn('[ModelRegistry] Failed to index bundled models:', err);
  }

  // 2. Load user-imported models (if available via IPC)
  let userModels: ModelConfig[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const remote = (window as any).electronAPI?.petModel;
    if (remote?.listUserModels) {
      const imported: Array<{
        id: string;
        name: string;
        path: string;
        window?: { width: number; height: number };
        actions?: Record<string, ModelActionConfig>;
        capabilities?: ModelCapabilities;
      }>
        = await remote.listUserModels();
      userModels = imported.filter((m): m is typeof m & { id: string; name: string; path: string } =>
        Boolean(m.id && m.name && m.path),
      ).map((m) => ({
        id: m.id,
        name: m.name,
        path: m.path,
        window: m.window,
        canvas: m.window ? { width: m.window.width, height: m.window.height } : undefined,
        actions: m.actions,
        capabilities: m.capabilities,
      }));
    }
  } catch (err) {
    console.warn('[ModelRegistry] Failed to list user models:', err);
  }

  // 3. Merge: user models override built-in models with same ID
  const builtInMap = new Map(builtIn.map((m) => [m.id, m]));
  for (const userModel of userModels) {
    builtInMap.set(userModel.id, userModel);
  }

  return Array.from(builtInMap.values());
}
