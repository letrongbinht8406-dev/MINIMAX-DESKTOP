import { useState } from 'react'
import { Pin } from 'lucide-react'
import { providerCatalog } from '../lib/imageProviders/index'
import { clearStudioPin, studioPinOf } from '../lib/imageProviders/studioPin'
import type { CustomImageModel } from '../lib/imageProviders/customRegistry'

/** 资产文件「已固定模型」徽章：显示 pin 的 provider，解除后回到全局设置。targets 用于一资产多目标（如角色 master/sheet）。 */
export function StudioPinBadge({ studio, assetId, target = 'main', targets, customModels = [] }: {
  studio: string
  assetId: string
  target?: string
  targets?: string[]
  customModels?: CustomImageModel[]
}) {
  const [version, bump] = useState(0)
  void version
  const list = targets ?? [target]
  const pins = list
    .map((key) => ({ key, pin: studioPinOf(studio, assetId, key) }))
    .filter((entry): entry is { key: string; pin: NonNullable<ReturnType<typeof studioPinOf>> } => Boolean(entry.pin))
  if (!pins.length) return null
  return (
    <>
      {pins.map(({ key, pin }) => {
        const provider = providerCatalog(customModels).find((entry) => entry.id === pin.providerId)
        return (
          <span key={key} className="studio-pin-badge" title="这个文件固定用该模型生成；解除后跟随全局图像模型设置">
            <Pin size={11} /> 已固定（{key === 'main' ? '文件' : key}）：{provider?.label ?? pin.providerId}
            <button type="button" onClick={() => { clearStudioPin(studio, assetId, key); bump((value) => value + 1) }}>解除</button>
          </span>
        )
      })}
    </>
  )
}
