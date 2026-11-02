import { imageProviders } from './index'
import type { ModelProvider, ComponentRequirement } from './provider'
import type { ComponentRole } from './types'

/**
 * User-registered image models: a chosen base template (one of the built-in
 * provider families) plus pinned component filenames. The custom entry never
 * mutates the shared built-in providers — each custom provider is a clone
 * with exact-match prefer regexes.
 */
export interface CustomImageModel {
  id: string
  name: string
  /** base template: one of the built-in provider ids */
  templateId: string
  /** pinned filenames keyed by role; missing keys fall back to the template's prefer order */
  components: Partial<Record<ComponentRole, string>>
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\\]/g, String.fromCharCode(92) + '$&')

export function createCustomProvider(entry: CustomImageModel): ModelProvider | null {
  const base = imageProviders.find((provider) => provider.id === entry.templateId)
  if (!base) return null
  const pin = (requirement: ComponentRequirement): ComponentRequirement => {
    const file = entry.components[requirement.role]
    if (!file) return requirement
    return { ...requirement, prefer: [new RegExp('^' + escapeRegExp(file) + '$')] }
  }
  return {
    ...base,
    id: 'custom-' + entry.id,
    label: entry.name,
    requires: base.requires.map(pin),
    modeRequires: base.modeRequires
      ? Object.fromEntries(Object.entries(base.modeRequires).map(([mode, requirements]) => [mode, requirements.map(pin)]))
      : undefined,
    custom: { modelId: entry.id, templateId: base.id },
  }
}

export function buildCustomProviders(entries: CustomImageModel[]): ModelProvider[] {
  const seen = new Set<string>()
  const providers: ModelProvider[] = []
  for (const entry of entries) {
    if (!entry.id || seen.has(entry.id)) continue
    seen.add(entry.id)
    const provider = createCustomProvider(entry)
    if (provider) providers.push(provider)
  }
  return providers
}

/** Full catalog: built-ins first, then the user's custom registrations. */
export function providerCatalog(entries: CustomImageModel[] = []): ModelProvider[] {
  return [...imageProviders, ...buildCustomProviders(entries)]
}
