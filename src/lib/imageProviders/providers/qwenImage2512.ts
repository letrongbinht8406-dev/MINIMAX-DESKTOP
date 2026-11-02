import { ref, type GraphIR } from '../ir'
import { chainUserLoras, type BuildInput, type ModelProvider } from '../provider'
import { defaultImageOptions } from '../types'

/**
 * Qwen-Image 2512 —— 通义 2512 版文生图。
 *
 * 连线**照抄 Comfy-Org 官方模板** `image_qwen_Image_2512.json`
 * （subgraph "Text to Image (Qwen-Image 2512)"）。与 2.1 版的差别：
 *
 *   1. **潜空间是 SD3 的**（`EmptySD3LatentImage`），2.1 用的是 `EmptyLatentImage`。
 *   2. **多一个 `ModelSamplingAuraFlow`**（shift≈3.1）做采样分布校正 —— 漏了会糊。
 *   3. **文本编码器换成了 Qwen2.5-VL-7B**（`type: qwen_image`），2.1 用的是 Qwen3-VL。
 *   4. 官方推荐 **50 步、cfg 4**（比 2.1 的 25 步 cfg 1 更"重"）。
 *
 * 官方模板还带一条 Lightning-4step LoRA 支路，用 ComfySwitchNode 切换；
 * 本实现不接那条支路 —— 少一个可选加速路径，但连线更简单、行为更可预测。
 */
export const qwenImage2512: ModelProvider = {
  id: 'qwen-image-2512',
  label: 'Qwen-Image 2512',
  family: 'Qwen',
  description: 'AuraFlow 调度 + Qwen2.5-VL 编码器，官方 50 步 cfg 4',
  modality: 'image',
  capabilities: ['t2i'],
  requiresNodes: [
    'UNETLoader',
    'CLIPLoader',
    'VAELoader',
    'CLIPTextEncode',
    'EmptySD3LatentImage',
    'ModelSamplingAuraFlow',
    'KSampler',
    'VAEDecode',
    'SaveImage',
    'LoadImage',
    'ImageScaleToTotalPixels',
    'GetImageSize',
  ],
  requires: [
    {
      role: 'diffusion',
      node: 'UNETLoader',
      field: 'unet_name',
      prefer: [/^qwen_image_2512.*\.safetensors$/i, /qwen.*2512/i],
      hint: 'qwen_image_2512_fp8_e4m3fn.safetensors',
    },
    {
      role: 'textEncoder',
      node: 'CLIPLoader',
      field: 'clip_name',
      // 本机文件名带了个多余的后缀（qwen_2.5_vl_7b_fp8_scaled.safetensors_..safetensors），
      // 所以正则不能锚定结尾。
      prefer: [/^qwen_2\.5_vl_7b.*\.safetensors/i, /qwen_2\.5_vl/i, /qwen.*vl.*\.safetensors/i],
      hint: 'qwen_2.5_vl_7b_fp8_scaled.safetensors',
    },
    {
      role: 'vae',
      node: 'VAELoader',
      field: 'vae_name',
      prefer: [/^qwen_image_vae.*\.safetensors$/i, /qwen.*vae/i],
      hint: 'qwen_image_vae.safetensors',
    },
  ],
  defaults: { ...defaultImageOptions, steps: 50, cfg: 4, sampler: 'euler', scheduler: 'simple' },
  constraints: { steps: [1, 80], cfg: [1, 10], maxBatch: 4, sizeStep: 32, maxSide: 2048, maxReferences: 1 },

  build({ options, components }: BuildInput): GraphIR {
    const nodes: GraphIR['nodes'] = {
      diffusion: {
        classType: 'UNETLoader',
        inputs: { unet_name: components.diffusion, weight_dtype: 'default' },
      },
      textEncoder: {
        classType: 'CLIPLoader',
        inputs: { clip_name: components.textEncoder, type: 'qwen_image', device: 'default' },
      },
      vae: { classType: 'VAELoader', inputs: { vae_name: components.vae } },
    }

    // AuraFlow 采样分布校正（官方 shift=3.1）。
    nodes.sampling = {
      classType: 'ModelSamplingAuraFlow',
      inputs: { model: chainUserLoras(nodes, ref('diffusion'), options.loras), shift: 3.1 },
    }

    nodes.positive = {
      classType: 'CLIPTextEncode',
      inputs: { text: options.prompt, clip: ref('textEncoder') },
    }
    nodes.negative = {
      classType: 'CLIPTextEncode',
      inputs: { text: options.negativePrompt, clip: ref('textEncoder') },
    }
    nodes.latent = {
      classType: 'EmptySD3LatentImage',
      inputs: { width: options.width, height: options.height, batch_size: options.batchSize },
    }
    nodes.sampler = {
      classType: 'KSampler',
      inputs: {
        model: ref('sampling'),
        seed: options.seed,
        steps: options.steps,
        cfg: options.cfg,
        sampler_name: options.sampler,
        scheduler: options.scheduler,
        positive: ref('positive'),
        negative: ref('negative'),
        latent_image: ref('latent'),
        denoise: 1,
      },
    }
    nodes.decode = { classType: 'VAEDecode', inputs: { samples: ref('sampler'), vae: ref('vae') } }
    nodes.save = {
      classType: 'SaveImage',
      inputs: { images: ref('decode'), filename_prefix: options.filenamePrefix?.trim() || 'qwen2512' },
    }

    return { nodes, outputs: { image: 'save' } }
  },
}
