import { ref, type GraphIR, type NodeRef } from './ir'
import type { Capability, ComponentRole, GenerationMode, ImageOptions, Modality } from './types'

/**
 * A provider is a pure function from intent to graph. It must not know about
 * filenames, GPU state, HTTP, React, or the DOM — that separation is what makes
 * adding a model a one-file change.
 */
export interface ComponentRequirement {
  role: ComponentRole
  /** ComfyUI node whose enum is the authoritative list of installed files */
  node: string
  /** input field on that node holding the filename enum */
  field: string
  /** ordered preference; first match wins, so put exact names first */
  prefer: RegExp[]
  optional?: boolean
  /** user-facing note shown when nothing matches */
  hint?: string
}

export interface ProviderConstraints {
  steps?: [number, number]
  cfg?: [number, number]
  maxBatch?: number
  /** width/height must be a multiple of this */
  sizeStep?: number
  maxSide?: number
  maxReferences?: number
}

export interface BuildInput<TRecipe = unknown> {
  options: ImageOptions
  /** resolved filenames keyed by role */
  components: Partial<Record<ComponentRole, string>>
  /**
   * Optional flavour of the same model — same graph, different recipe.
   *
   * MiniMax H3 is the motivating case: the Turbo 4-step build and the
   * 8-step distilled build share the entire sampling chain and differ only in
   * whether a turbo LoRA is attached and how many steps to run. Passing the
   * recipe through `BuildInput` lets one provider serve both without
   * duplicating a 400-line graph builder.
   *
   * Providers that don't use recipes ignore it.
   */
  recipe?: TRecipe
}

export interface ModelProvider {
  id: string
  label: string
  family: string
  description: string
  /** what this provider produces; decides which workspace and form renders it */
  modality: Modality
  /** modes actually implemented by `build`, not aspirational ones */
  capabilities: Capability[]
  requires: ComponentRequirement[]
  /**
   * Components needed only in a specific mode. The edit LoRA is the motivating
   * case: its absence must block editing without blocking text-to-image.
   */
  modeRequires?: Partial<Record<GenerationMode, ComponentRequirement[]>>
  /** Sampling recipe per mode — an edit LoRA is usually trained at different values */
  modeDefaults?: Partial<Record<GenerationMode, Partial<ImageOptions>>>
  /** ComfyUI nodes that must exist before this provider can queue anything */
  requiresNodes: string[]
  defaults: Partial<ImageOptions>
  constraints?: ProviderConstraints
  /**
   * Set on providers that came from the user's own model registry.
   *
   * The UI uses it to tell built-in models apart from the user's, and the
   * workflow matcher uses `templateId` to offer the right workflows without
   * any hard-coded table.
   */
  custom?: { modelId: string; templateId: string }
  build(input: BuildInput): GraphIR
}

/** Clamp user values into a provider's declared envelope. */
export function clampOptions(provider: ModelProvider, options: ImageOptions): ImageOptions {
  const c = provider.constraints ?? {}
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
  const step = c.sizeStep ?? 8
  const maxSide = c.maxSide ?? 2048
  const references = options.references.slice(0, c.maxReferences ?? (provider.modality === 'video' ? 2 : 4))
  const loras = (options.loras ?? [])
    .filter((lora) => lora.name.trim())
    .slice(0, MAX_USER_LORAS)
    .map((lora) => ({ name: lora.name, strength: clamp(lora.strength, -2, 2) }))
  // A mode only survives if it still has what it needs: editing needs a
  // reference, image-to-video needs a first frame, first-and-last needs two.
  let mode: GenerationMode
  if (provider.modality === 'video') {
    mode =
      options.mode === 'concat' && references.length >= 2
        ? 'concat'
        : options.mode === 'continuation' && references.length >= 1
          ? 'continuation'
          : options.mode === 'flf2v' && references.length >= 2
            ? 'flf2v'
            : options.mode === 'i2v' && references.length >= 1
              ? 'i2v'
              : 't2v'
  } else {
    mode = options.mode === 'edit' && references.length > 0 ? 'edit' : 't2i'
  }
  return {
    ...options,
    steps: c.steps ? clamp(Math.round(options.steps), c.steps[0], c.steps[1]) : options.steps,
    cfg: c.cfg ? clamp(options.cfg, c.cfg[0], c.cfg[1]) : options.cfg,
    batchSize: c.maxBatch ? clamp(options.batchSize, 1, c.maxBatch) : options.batchSize,
    width: Math.round(clamp(options.width, step, maxSide) / step) * step,
    height: Math.round(clamp(options.height, step, maxSide) / step) * step,
    mode,
    references: mode === 't2i' || mode === 't2v' ? [] : references,
    loras,
  }
}

export const MAX_USER_LORAS = 1

/**
 * Chain the user's LoRAs onto a model link. Kept separate so every provider uses
 * the same ordering rule: the provider's own LoRA first, then the user's.
 */
export function chainUserLoras(
  nodes: GraphIR['nodes'],
  model: NodeRef,
  loras: ImageOptions['loras'],
): NodeRef {
  let link = model
  ;(loras ?? []).slice(0, MAX_USER_LORAS).forEach((lora, index) => {
    const key = `userLora${index}`
    nodes[key] = {
      classType: 'LoraLoaderModelOnly',
      inputs: { model: link, lora_name: lora.name, strength_model: lora.strength },
    }
    link = ref(key)
  })
  return link
}

/** ComfyUI wants `subfolder/name`, always with forward slashes. */
export function remotePath(file: { name: string; subfolder?: string }): string {
  return file.subfolder ? `${file.subfolder.replace(/\\/g, '/')}/${file.name}` : file.name
}
