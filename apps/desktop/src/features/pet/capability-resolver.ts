import { BehaviorExpression, BehaviorProp } from './behavior-types';
import { ModelConfig } from './model-registry';

export interface ResolvedPropCommand {
  params: Record<string, number>;
}

export function resolveExpressionCapability(
  model: ModelConfig | undefined,
  expression: BehaviorExpression | null,
): string | null | undefined {
  if (!expression || expression === 'neutral') return null;

  const configured = model?.capabilities?.expressions?.[expression];
  if (configured !== undefined) return configured;

  return undefined;
}

export function resolvePropCapabilities(
  model: ModelConfig | undefined,
  props: BehaviorProp[],
): ResolvedPropCommand {
  const params: Record<string, number> = {};
  const capabilities = model?.capabilities?.props ?? {};
  const fallbacks = model?.capabilities?.propFallbacks ?? {};

  for (const capability of Object.values(capabilities)) {
    if (capability.disable) {
      Object.assign(params, capability.disable);
    }
  }

  for (const prop of props) {
    const resolvedName = resolvePropName(prop.name, capabilities, fallbacks);
    const capability = resolvedName ? capabilities[resolvedName] : undefined;
    const values = prop.enabled ? capability?.enable : capability?.disable;
    if (values) {
      Object.assign(params, values);
    }
  }
  return { params };
}

function resolvePropName(
  name: string,
  capabilities: NonNullable<ModelConfig['capabilities']>['props'],
  fallbacks: NonNullable<ModelConfig['capabilities']>['propFallbacks'],
): string | undefined {
  if (capabilities?.[name]) return name;
  for (const fallback of fallbacks?.[name] ?? []) {
    if (capabilities?.[fallback]) return fallback;
  }
  return undefined;
}
