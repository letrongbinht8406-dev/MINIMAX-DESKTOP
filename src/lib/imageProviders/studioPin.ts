import { loadFilePins, saveFilePin, clearFilePin, type ZImageFilePin } from '../zimagePin'
import { providerCatalog } from './index'
import type { CustomImageModel } from './customRegistry'

/**
 * 资产 studio（角色/服装/发型/地点/配饰）的逐文件 pin，复用 zimagePin 存储层。
 * 语义：每个资产文件记住「用哪个模型生成的」；buildStill 再生图时 pin 优先于
 * 全局 settings.imageProviderId（用户可经 StudioPinBadge 解除 pin 回到全局设置）。
 * 红线：key/providerId/resolution 全英文，绝不存模型侧描述串。
 */
export const studioAssetKey = (studio: string, assetId: string, target = 'main') => `asset:${studio}:${assetId}:${target}`

export type PinStorage = Pick<Storage, 'getItem' | 'setItem'>

/** 该资产文件 pin 的 providerId（pin 存在且 provider 仍在目录里），否则 undefined。 */
export function pinnedStudioProvider(studio: string, assetId: string, customModels: CustomImageModel[] = [], target = 'main', storage: PinStorage = globalThis.localStorage): string | undefined {
  const pin = loadFilePins(storage)[studioAssetKey(studio, assetId, target)]
  if (!pin) return undefined
  if (providerCatalog(customModels).some((provider) => provider.id === pin.providerId)) return pin.providerId
  return undefined
}

/** 生成成功后记录 pin（steps/cfg/seed 由 studio 再生图逻辑自行决定，这里只记 provider + 分辨率）。 */
export function recordStudioPin(studio: string, assetId: string, providerId: string | undefined, resolution: string, customModels: CustomImageModel[] = [], target = 'main', storage: PinStorage = globalThis.localStorage): void {
  if (!providerId) return
  // 只有目录里仍存在的 provider 才值得 pin（已删除的自定义模型/legacy 管线不落盘）
  if (!providerCatalog(customModels).some((provider) => provider.id === providerId)) return
  const pin: ZImageFilePin = {
    fileId: studioAssetKey(studio, assetId, target),
    providerId,
    steps: 0,
    cfg: 0,
    seed: 0,
    resolution,
    pinnedAt: Date.now(),
  }
  saveFilePin(pin, storage)
}

export function clearStudioPin(studio: string, assetId: string, target = 'main', storage: PinStorage = globalThis.localStorage): void {
  clearFilePin(studioAssetKey(studio, assetId, target), storage)
}

export function studioPinOf(studio: string, assetId: string, target = 'main', storage: PinStorage = globalThis.localStorage): ZImageFilePin | undefined {
  return loadFilePins(storage)[studioAssetKey(studio, assetId, target)]
}
