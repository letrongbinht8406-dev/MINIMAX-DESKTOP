import { ref, type GraphIR } from '../ir'
import { chainUserLoras, remotePath, type BuildInput, type ModelProvider } from '../provider'
import { defaultImageOptions } from '../types'

/**
 * Z-Image —— 阿里通义的高效文生图模型。
 *
 * 连线**照抄 Comfy-Org 官方模板** `image_z_image.json`（subgraph
 * "Text to Image(Z-Image-Base Int8)"），不靠猜。三处踩过坑的地方：
 *
 *   1. **CLIPLoader 的 type 是 `lumina2`**，不是 `sd3` 也不是 `z_image`。
 *      传错会让文本编码器的隐藏维度对不上 —— 报
 *      "expected input with shape [*2560], but got input of size[1, 29, 4096]"。
 *   2. **采样分布节点是 `ModelSamplingAuraFlow`**（shift=3），不是
 *      `ModelSamplingSD3`。Z-Image 用的是 AuraFlow 调度，不是 SD3 调度。
 *   3. **文本编码用普通 `CLIPTextEncode`**，不需要 `TextEncodeZImageOmni`
 *      —— 那个节点是给"参考图直出"变体用的，纯文生图用不上。
 *
 * 官方建议 steps 30–50、cfg 3–5；这是它"慢但稳"的调法。
 */
export const zImage: ModelProvider = {
  id: 'z-image',
  label: 'Z-Image',
  family: 'Z-Image',
  description: 'AuraFlow 调度，官方推荐 30–50 步 cfg 3–5',
  modality: 'image',
  capabilities: ['t2i', 'edit'],
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
      prefer: [/^z[_-]?image.*\.safetensors$/i, /z[_-]?image/i],
      hint: 'z_image_bf16.safetensors',
    },
    {
      role: 'textEncoder',
      node: 'CLIPLoader',
      field: 'clip_name',
      // 官方用 qwen_3_4b；本机装的是 qwen3.5_9b，同属 Qwen3 系，可用。
      prefer: [/^qwen_3_4b.*\.safetensors$/i, /^qwen3\.5.*\.safetensors$/i, /^qwen3.*\.safetensors$/i],
      hint: 'qwen_3_4b.safetensors',
    },
    {
      role: 'vae',
      node: 'VAELoader',
      field: 'vae_name',
      // 排除 *-tmp / *official-tmp 这类调试残留文件。
      prefer: [/^ae.*\.safetensors$/i, /^flux2-vae_small.*\.safetensors$/i, /^flux2-vae(?!.*tmp).*\.safetensors$/i],
      hint: 'ae.safetensors',
    },
  ],
  defaults: { ...defaultImageOptions, steps: 30, cfg: 4, sampler: 'res_multistep', scheduler: 'simple' },
  constraints: { steps: [1, 60], cfg: [1, 10], maxBatch: 4, sizeStep: 16, maxSide: 2048, maxReferences: 1 },

  build({ options, components }: BuildInput): GraphIR {
    const references = options.mode === 'edit' ? options.references : []

    const nodes: GraphIR['nodes'] = {
      diffusion: {
        classType: 'UNETLoader',
        inputs: { unet_name: components.diffusion, weight_dtype: 'default' },
      },
      textEncoder: {
        // type 必须是 lumina2 —— 官方模板就是这么连的。
        classType: 'CLIPLoader',
        inputs: { clip_name: components.textEncoder, type: 'lumina2', device: 'default' },
      },
      vae: { classType: 'VAELoader', inputs: { vae_name: components.vae } },
    }

    // AuraFlow 调度：Z-Image 的采样分布校正节点（官方 shift=3）。
    nodes.sampling = {
      classType: 'ModelSamplingAuraFlow',
      inputs: { model: chainUserLoras(nodes, ref('diffusion'), options.loras), shift: 3 },
    }

    nodes.positive = {
      classType: 'CLIPTextEncode',
      inputs: { text: options.prompt, clip: ref('textEncoder') },
    }
    nodes.negative = {
      classType: 'CLIPTextEncode',
      inputs: { text: options.negativePrompt, clip: ref('textEncoder') },
    }

    if (references.length) {
      // 图生图：参考图缩放后直接当 latent 起点，用 denoise 控制改动幅度。
      nodes.source = { classType: 'LoadImage', inputs: { image: remotePath(references[0]) } }
      nodes.scale = {
        classType: 'ImageScaleToTotalPixels',
        inputs: { image: ref('source'), upscale_method: 'lanczos', megapixels: 1, resolution_steps: 16 },
      }
    } else {
      nodes.latent = {
        classType: 'EmptySD3LatentImage',
        inputs: { width: options.width, height: options.height, batch_size: options.batchSize },
      }
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
        latent_image: references.length ? ref('scale') : ref('latent'),
        denoise: references.length ? 0.6 : 1,
      },
    }

    nodes.decode = { classType: 'VAEDecode', inputs: { samples: ref('sampler'), vae: ref('vae') } }
    nodes.save = {
      classType: 'SaveImage',
      inputs: {
        images: ref('decode'),
        filename_prefix: options.filenamePrefix?.trim() || (references.length ? 'zimage_edit' : 'zimage'),
      },
    }

    return { nodes, outputs: { image: 'save' } }
  },
}
