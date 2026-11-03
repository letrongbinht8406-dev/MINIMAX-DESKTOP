import type { ModelProvider } from './imageProviders/provider'

/**
 * 逐文件 pin：每个由 Z-Image 工作区生成的图像文件记住「用哪个 provider + 参数」生成，
 * 重新生成同一文件时优先恢复该 pin（自定义模型表单的持久化层）。
 * 红线：pin 只存 providerId/枚举/数字（英文），绝不存模型侧描述串。
 */
export interface ZImageFilePin {
  fileId: string
  providerId: string
  steps: number
  cfg: number
  seed: number
  resolution: string
  pinnedAt: number
}

const STORAGE_KEY = 'zimage.file-pins.v1'

export function loadFilePins(storage: Pick<Storage, 'getItem'> = globalThis.localStorage): Record<string, ZImageFilePin> {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const out: Record<string, ZImageFilePin> = {}
    for (const [fileId, value] of Object.entries(parsed)) {
      if (typeof value !== 'object' || value === null) continue
      const pin = value as Partial<ZImageFilePin>
      if (typeof pin.providerId !== 'string' || typeof pin.steps !== 'number' || typeof pin.cfg !== 'number' || typeof pin.seed !== 'number' || typeof pin.resolution !== 'string') continue
      out[fileId] = { fileId, providerId: pin.providerId, steps: pin.steps, cfg: pin.cfg, seed: pin.seed, resolution: pin.resolution, pinnedAt: typeof pin.pinnedAt === 'number' ? pin.pinnedAt : 0 }
    }
    return out
  } catch {
    return {}
  }
}

export function saveFilePin(pin: ZImageFilePin, storage: Pick<Storage, 'setItem' | 'getItem'> = globalThis.localStorage): Record<string, ZImageFilePin> {
  const next = { ...loadFilePins(storage), [pin.fileId]: pin }
  storage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function clearFilePin(fileId: string, storage: Pick<Storage, 'setItem' | 'getItem'> = globalThis.localStorage): Record<string, ZImageFilePin> {
  const next = loadFilePins(storage)
  delete next[fileId]
  storage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

/** 纯函数：该文件有 pin 且 provider 在目录里 → 恢复 pin 的 providerId；否则用当前 providerId（旧行为零变化）。 */
export function resolvePinnedProvider(pins: Record<string, ZImageFilePin>, catalog: readonly ModelProvider[], fileId: string, fallbackProviderId: string): string {
  const pin = fileId ? pins[fileId] : undefined
  if (pin && catalog.some((provider) => provider.id === pin.providerId)) return pin.providerId
  return fallbackProviderId
}
