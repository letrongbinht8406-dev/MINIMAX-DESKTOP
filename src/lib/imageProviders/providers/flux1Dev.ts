import { ref, type GraphIR } from '../ir'
import { chainUserLoras, remotePath, type BuildInput, type ModelProvider } from '../provider'
import { defaultImageOptions, type ImageOptions } from '../types'

/**
 * Flux.1-dev —— 文本生图 + 图生图（img2img）。
 *
 * 这是"完整 checkpoint"路线（`CheckpointLoaderSimple` 一次加载 UNet+CLIP+VAE），
 * 与 MOSS-Image / Qwen-Image 的"分离加载器"路线不同。存在两个原因：
 *   1. Flux.1 的 CLIP 是 T5 + CLIP-L 双编码器，`CheckpointLoaderSimple` 里已经
 *      带好了，分开加载反而要自己拼两个 CLIPLoader；
 *   2. FP8 量化版通常只提供整合 checkpoint，没有单独的 text encoder。
 *
 * 图生图用 `KSampler` 的 denoise 参数实现（不是 MOSS 那套专用编辑节点），
 * denoise=0.6 保留原图结构、0.3 改动较大。
 */
export const flux1Dev: ModelProvider = {
  id: 'flux1-dev',
  label: 'Flux.1-dev',
  family: 'Flux',
  description: '整合 checkpoint，通用文生图，img2img 靠 denoise 控制改动幅度',
  modality: 'image',
  // 图像模态的"图生图"在本应用里叫 edit（GenerationMode 只有 edit / t2i），
  // 所以能力也标成 edit —— 标成 i2i 会与 clampOptions 的模式收窄对不上，
  // 那样 img2img 分支永远进不去。
  capabilities: ['t2i', 'edit'],
  requiresNodes: [
    'CheckpointLoaderSimple',
    'CLIPTextEncode',
    'EmptyLatentImage',
    'KSampler',
    'VAEDecode',
    'SaveImage',
    'LoadImage',
    'ImageScaleToTotalPixels',
    'GetImageSize',
    'LoraLoaderModelOnly',
  ],
  requires: [
    {
      role: 'diffusion',
      node: 'CheckpointLoaderSimple',
      field: 'ckpt_name',
      prefer: [/^flux1[-_.]?dev.*\.safetensors$/i, /flux.*dev/i],
      hint: 'flux1-dev-fp8.safetensors',
    },
  ],
  defaults: { ...defaultImageOptions, steps: 25, cfg: 3.5, sampler: 'euler', scheduler: 'normal' },
  // edit 模式用 denoise=0.6：保留原图结构、同时让提示词有发挥空间。
  modeDefaults: { edit: { steps: 20, cfg: 3.5, sampler: 'euler', scheduler: 'normal' } },
  constraints: { steps: [1, 60], cfg: [1, 12], maxBatch: 4, sizeStep: 16, maxSide: 2048, maxReferences: 1 },

  build({ options, components }: BuildInput): GraphIR {
    const references = options.mode === 'edit' ? options.references : []
    if (references.length) return buildImg2Img(options, components, remotePath(references[0]))

    const nodes: GraphIR['nodes'] = {
      checkpoint: {
        classType: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: components.diffusion },
      },
      positive: {
        classType: 'CLIPTextEncode',
        inputs: { text: options.prompt, clip: ref('checkpoint', 1) },
      },
      negative: {
        classType: 'CLIPTextEncode',
        inputs: { text: options.negativePrompt, clip: ref('checkpoint', 1) },
      },
      latent: {
        classType: 'EmptyLatentImage',
        inputs: { width: options.width, height: options.height, batch_size: options.batchSize },
      },
      decode: { classType: 'VAEDecode', inputs: { samples: ref('sampler'), vae: ref('checkpoint', 2) } },
      save: {
        classType: 'SaveImage',
        inputs: { images: ref('decode'), filename_prefix: options.filenamePrefix?.trim() || 'flux1' },
      },
    }

    nodes.sampler = {
      classType: 'KSampler',
      inputs: {
        model: chainUserLoras(nodes, ref('checkpoint', 0), options.loras),
        seed: options.seed,
        steps: options.steps,
        cfg: options.cfg,
        sampler_name: options.sampler,
        scheduler: options.scheduler,
        positive: ref('positive', 0),
        negative: ref('negative', 0),
        latent_image: ref('latent'),
        denoise: 1,
      },
    }

    return { nodes, outputs: { image: 'save' } }
  },
}

/** img2img：参考图缩放到目标尺寸后作为 latent 起点，用 denoise 控制改动幅度。 */
function buildImg2Img(options: ImageOptions, components: BuildInput['components'], source: string): GraphIR {
  const nodes: GraphIR['nodes'] = {
    checkpoint: { classType: 'CheckpointLoaderSimple', inputs: { ckpt_name: components.diffusion } },
    source: { classType: 'LoadImage', inputs: { image: source } },
    scale: {
      classType: 'ImageScaleToTotalPixels',
      inputs: { image: ref('source'), upscale_method: 'lanczos', megapixels: 1, resolution_steps: 16 },
    },
    size: { classType: 'GetImageSize', inputs: { image: ref('scale') } },
    positive: { classType: 'CLIPTextEncode', inputs: { text: options.prompt, clip: ref('checkpoint', 1) } },
    negative: { classType: 'CLIPTextEncode', inputs: { text: options.negativePrompt, clip: ref('checkpoint', 1) } },
    decode: { classType: 'VAEDecode', inputs: { samples: ref('sampler'), vae: ref('checkpoint', 2) } },
    save: {
      classType: 'SaveImage',
      inputs: { images: ref('decode'), filename_prefix: options.filenamePrefix?.trim() || 'flux1_i2i' },
    },
  }

  nodes.sampler = {
    classType: 'KSampler',
    inputs: {
      model: chainUserLoras(nodes, ref('checkpoint', 0), options.loras),
      seed: options.seed,
      steps: options.steps,
      cfg: options.cfg,
      sampler_name: options.sampler,
      scheduler: options.scheduler,
      positive: ref('positive', 0),
      negative: ref('negative', 0),
      // 原图直接当 latent 起点；denoise 越低越贴近原图。
      latent_image: ref('scale'),
      denoise: 0.6,
    },
  }

  return { nodes, outputs: { image: 'save' } }
}
