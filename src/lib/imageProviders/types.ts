/**
 * Shared vocabulary for the pluggable image-generation core.
 *
 * Ported from the ImageStudio workbench (WorkBuddy) core: providers are pure
 * functions from intent to ComfyUI graph. The capability list is deliberately
 * wider than what is implemented today: video capabilities exist as types from
 * the start so adding a video provider later does not touch the type system,
 * the registry, or the UI switch.
 *
 * Red line: every value that reaches ComfyUI stays English (see docs/LOCALIZATION_ZH.md).
 */
export type Capability =
  | 't2i'
  | 'i2i'
  | 'edit'
  | 'inpaint'
  | 't2v'
  | 'i2v'
  | 'flf2v'
  | 'ref2v'
  | 'continuation'
  | 'concat'

export type ComponentRole =
  | 'diffusion'
  | 'textEncoder'
  | 'vae'
  /** H3 decodes video and audio from separate VAEs, so they need separate slots */
  | 'audioVae'
  | 'clipVision'
  | 'lora'
  /** the provider's own turbo LoRA, which must load before any user LoRA */
  | 'turboLora'
  | 'upscaler'

/** What a provider produces. Image and video share the graph pipeline but not the form. */
export type Modality = 'image' | 'video'

/** A file the ComfyUI server has already indexed (never a local path). */
export interface RemoteFile {
  name: string
  subfolder?: string
  type?: string
  /** duration in seconds; only known for videos the app measured itself */
  duration?: number
}

/** Text to image, editing an existing image with reference input, and the video modes. */
export type GenerationMode = 't2i' | 'edit' | 't2v' | 'i2v' | 'flf2v' | 'continuation' | 'concat'

/** A user-selected LoRA on top of whatever the provider already loads. */
export interface AppliedLora {
  name: string
  strength: number
}

export interface ImageOptions {
  mode: GenerationMode
  prompt: string
  negativePrompt: string
  width: number
  height: number
  steps: number
  cfg: number
  sampler: string
  scheduler: string
  seed: number
  batchSize: number
  /** img2img 的去噪强度：1 = 完全重画（等于文生图），0.6 = 保留原图结构 */
  denoise?: number
  /** uploaded references; empty for text-to-image */
  references: RemoteFile[]
  /** extra LoRAs, applied after the provider's own stack */
  loras: AppliedLora[]
  /** prefix for the saved file, so batch output is named rather than qwen21_00007_ */
  filenamePrefix?: string
  /** video only: requested duration in seconds; H3 snaps it to the 17k+5 frame grid */
  seconds?: number
  /** video only: output frame rate (H3 is trained at 24) */
  fps?: number
  /** video only: cross-fade length at the seam when joining clips, 0 = hard cut */
  seamMs?: number
  /** video only: 在 sigma 尾部追加一步低噪声细化（ExtendIntermediateSigmas），不提升分辨率 */
  sigmaExtend?: boolean
  /** video only: 二采放大（latent upscale，潜空间超分提升分辨率/清晰度），需要 H3 latent upscale 模型 */
  secondPassUpscale?: boolean
}

export const defaultImageOptions: ImageOptions = {
  mode: 't2i',
  prompt: '',
  negativePrompt: '',
  width: 1024,
  height: 1024,
  steps: 25,
  cfg: 1,
  sampler: 'euler',
  scheduler: 'simple',
  seed: 0,
  batchSize: 1,
  references: [],
  loras: [],
  filenamePrefix: '',
}

/** One produced file, independent of media kind so video slots in unchanged. */
export interface Artifact {
  kind: 'image' | 'video' | 'audio'
  filename: string
  subfolder?: string
  type?: string
  url: string
  width?: number
  height?: number
}
