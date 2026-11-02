import type { ModelProvider } from './provider'
import { flux1Dev } from './providers/flux1Dev'
import { mossImage } from './providers/mossImage'
import { qwenImage21 } from './providers/qwenImage21'
import { qwenImage2512 } from './providers/qwenImage2512'
import { zImage } from './providers/zImage'

/**
 * Pluggable image-model providers, ported from the ImageStudio workbench.
 *
 * 加一个内置模型：写一个 provider 模块，加到这里。
 * 用户自定义模型注册（custom model registry）与视频 provider（H3/comfyTv）
 * 属于后续批次，暂不移植 —— 视频侧以 Oyama 现有 H3 管线为准。
 */
export const imageProviders: ModelProvider[] = [
  qwenImage21,
  qwenImage2512,
  mossImage,
  flux1Dev,
  zImage,
]

export { buildCustomProviders, createCustomProvider, providerCatalog, type CustomImageModel } from './customRegistry'
