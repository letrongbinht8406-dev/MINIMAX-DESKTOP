import { imageProviders } from './index'
import { buildImageGraph, resolveProvider, type ProviderResolution } from './resolve'
import { defaultImageOptions, type ImageOptions } from './types'
import type { ObjectInfo } from '../comfyInfo'

/**
 * Five asset studios share a single submission helper: explicit provider
 * choice first, Z-Image legacy pipeline when its files are installed (keeps
 * attention-backend routing), otherwise the first available provider.
 */

export function listImageProviderResolutions(info: ObjectInfo, mode: ImageOptions['mode'] = 't2i'): ProviderResolution[] {
  return imageProviders.map((provider) => resolveProvider(info, provider, mode))
}

export function anyImageProviderAvailable(info: ObjectInfo): boolean {
  return listImageProviderResolutions(info).some((resolution) => resolution.available)
}

export type StudioImageResult =
  | { ok: true; prompt: ReturnType<typeof buildImageGraph>; providerId: string; providerLabel: string }
  | { ok: false; error: string }

/**
 * providerId: null = auto-pick the first available provider; a registry id =
 * use exactly that provider (fail with an actionable error if unavailable).
 */
export function studioImagePrompt(info: ObjectInfo, providerId: string | null, request: Partial<ImageOptions>): StudioImageResult {
  const mode = request.mode ?? 't2i'
  const resolutions = imageProviders.map((provider) => resolveProvider(info, provider, mode))
  const explicit = providerId ? resolutions.find((entry) => entry.provider.id === providerId) : undefined
  const target = explicit ?? (mode === 'edit' ? undefined : resolutions.find((entry) => entry.available))
  if (!target || !target.available) {
    if (target) return { ok: false, error: target.missing.join('; ') }
    return { ok: false, error: providerId ? 'selected model unavailable' : 'no image provider available' }
  }
  const provider = target.provider
  const options: ImageOptions = {
    ...defaultImageOptions,
    ...request,
    mode,
    steps: request.steps ?? provider.defaults.steps ?? defaultImageOptions.steps,
    cfg: request.cfg ?? provider.defaults.cfg ?? defaultImageOptions.cfg,
    sampler: request.sampler ?? provider.defaults.sampler ?? defaultImageOptions.sampler,
    scheduler: request.scheduler ?? provider.defaults.scheduler ?? defaultImageOptions.scheduler,
  }
  return { ok: true, prompt: buildImageGraph(info, provider, options), providerId: provider.id, providerLabel: provider.label }
}
