import { choices, type ObjectInfo } from '../comfyInfo'
import { lowerGraph, type ComfyPrompt as LoweredComfyPrompt } from './ir'
import type { BuildInput, ComponentRequirement, ModelProvider } from './provider'
import { clampOptions } from './provider'
import type { GenerationMode, ImageOptions } from './types'
import { imageProviders } from './index'

/**
 * Oyama-side adapter over the ported provider core.
 *
 * The core (types/ir/provider + providers/) stays transport-agnostic; this file
 * is where it meets Oyama's object_info discovery and ComfyPrompt submission.
 *
 * Resolution semantics match the ImageStudio catalog: /object_info is
 * authoritative — model files are matched by each ComponentRequirement's
 * ordered prefer regexes against the node's filename enum, first match wins.
 */
export interface ProviderResolution {
  provider: ModelProvider
  /** every required node class exists and every required component file matched */
  available: boolean
  /** resolved filenames keyed by role; empty when unavailable */
  components: Partial<Record<string, string>>
  /** actionable missing-requirement notes (may be Chinese) */
  missing: string[]
}

/** pickModel: walk the prefer regexes in order; first regex with a hit wins. */
export function pickFile(pool: string[], prefer: RegExp[]): string | undefined {
  for (const expression of prefer) {
    const hit = pool.find((name) => expression.test(name))
    if (hit) return hit
  }
  return undefined
}

export function resolveProvider(info: ObjectInfo, provider: ModelProvider, mode: GenerationMode = 't2i'): ProviderResolution {
  const components: Partial<Record<string, string>> = {}
  const missing: string[] = []
  const absentNodes = provider.requiresNodes.filter((node) => !(node in info))
  if (absentNodes.length) missing.push('missing nodes: ' + absentNodes.join(', '))
  const requirements: ComponentRequirement[] = [
    ...provider.requires,
    ...(mode === 'edit' ? provider.modeRequires?.edit ?? [] : []),
  ]
  for (const requirement of requirements) {
    if (absentNodes.includes(requirement.node)) continue
    const hit = pickFile(choices(info, requirement.node, requirement.field), requirement.prefer)
    if (hit) components[requirement.role] = hit
    else missing.push(requirement.hint ? requirement.role + ' (expected: ' + requirement.hint + ')' : requirement.role + ' on ' + requirement.node)
  }
  return { provider, available: missing.length === 0, components, missing }
}

export function resolveAllImageProviders(info: ObjectInfo): ProviderResolution[] {
  return imageProviders.map((provider) => resolveProvider(info, provider))
}

/**
 * Build a submittable ComfyUI prompt for the given provider.
 * The lowered graph is plain ComfyUI JSON; submitPrompt accepts unknown, so the
 * lowered shape passes through as-is.
 */
export function buildImageGraph(info: ObjectInfo, provider: ModelProvider, options: ImageOptions): LoweredComfyPrompt {
  const clamped = clampOptions(provider, options)
  const resolution = resolveProvider(info, provider, clamped.mode)
  const graph = lowerGraph(provider.build({
    options: clamped,
    components: resolution.components as BuildInput['components'],
  }))
  return graph.prompt
}
