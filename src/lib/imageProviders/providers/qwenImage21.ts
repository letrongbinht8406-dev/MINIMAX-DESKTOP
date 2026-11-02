import { ref, type GraphIR } from '../ir'
import { chainUserLoras, remotePath, type BuildInput, type ModelProvider } from '../provider'
import { defaultImageOptions } from '../types'

/**
 * Qwen-Image 2.1 — text to image and instruction editing.
 *
 * Mirrors Comfy-Org's `image_qwen_image_2_1_t2i.json` and
 * `image_qwen_image_2_1_image_edit.json`. Both are the same encoder:
 *
 *   - no references -> EmptyLatentImage supplies the latent
 *   - references    -> TextEncodeQwenImage21 output slot 2 (its latent socket)
 *                      becomes the sampler latent, and the reference images are
 *                      encoded through the VAE into the text sequence
 *
 * The official path runs cfg 1 with euler/simple; raising cfg only makes sense
 * together with a real negative prompt.
 */
export const qwenImage21: ModelProvider = {
  id: 'qwen-image-2.1',
  label: 'Qwen-Image 2.1',
  family: 'Qwen',
  description: '原生 2K 文生图与指令编辑，官方推荐 cfg 1 + euler',
  modality: 'image',
  capabilities: ['t2i', 'edit'],
  requiresNodes: [
    'UNETLoader',
    'CLIPLoader',
    'VAELoader',
    'TextEncodeQwenImage21',
    'EmptyLatentImage',
    'KSampler',
    'VAEDecode',
    'SaveImage',
    'LoadImage',
  ],
  requires: [
    {
      role: 'diffusion',
      node: 'UNETLoader',
      field: 'unet_name',
      prefer: [/^qwen_image_2\.1.*\.safetensors$/i, /qwen.?image.?2\.1/i, /qwen_image/i],
      hint: 'qwen_image_2.1_int8_convrot.safetensors',
    },
    {
      role: 'textEncoder',
      node: 'CLIPLoader',
      field: 'clip_name',
      prefer: [/^qwen3vl_8b.*\.safetensors$/i, /^qwen3vl.*\.safetensors$/i, /qwen.*vl/i],
      hint: 'qwen3vl_8b_int8_convrot.safetensors',
    },
    {
      role: 'vae',
      node: 'VAELoader',
      field: 'vae_name',
      prefer: [/^qwen_image_2\.1_vae.*\.safetensors$/i, /^qwen_image_vae.*\.safetensors$/i, /qwen.*vae/i],
      hint: 'qwen_image_2.1_vae_bf16.safetensors',
    },
  ],
  defaults: { ...defaultImageOptions, steps: 25, cfg: 1, sampler: 'euler', scheduler: 'simple' },
  constraints: { steps: [1, 80], cfg: [1, 8], maxBatch: 8, sizeStep: 32, maxSide: 2048, maxReferences: 4 },

  build({ options, components }: BuildInput): GraphIR {
    const references = options.mode === 'edit' ? options.references : []

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

    // User LoRAs sit between the UNET and the cache node: the cache must wrap the
    // final model, otherwise a LoRA swap would silently reuse a stale prefix.
    nodes.cache = {
      classType: 'QwenImage21Cache',
      inputs: { model: chainUserLoras(nodes, ref('diffusion'), options.loras), device: 'auto', dtype: 'default' },
    }

    const encodeInputs: Record<string, unknown> = {
      clip: ref('textEncoder'),
      prompt: options.prompt,
      negative_prompt: options.negativePrompt,
      resolution: Math.max(options.width, options.height),
    }

    if (references.length) {
      // The VAE is required on this node only when it has to encode references.
      encodeInputs.vae = ref('vae')
      references.forEach((file, index) => {
        const key = `reference${index}`
        nodes[key] = { classType: 'LoadImage', inputs: { image: remotePath(file) } }
        encodeInputs[`images.image_${index + 1}`] = ref(key)
      })
    }

    nodes.encode = { classType: 'TextEncodeQwenImage21', inputs: encodeInputs }

    // Editing reuses the encoder's latent socket; text-to-image needs an empty one.
    if (references.length) {
      nodes.sampler = buildSampler(options, ref('encode', 2))
    } else {
      nodes.latent = {
        classType: 'EmptyLatentImage',
        inputs: { width: options.width, height: options.height, batch_size: options.batchSize },
      }
      nodes.sampler = buildSampler(options, ref('latent'))
    }

    nodes.decode = { classType: 'VAEDecode', inputs: { samples: ref('sampler'), vae: ref('vae') } }
    nodes.save = {
      classType: 'SaveImage',
      inputs: {
        images: ref('decode'),
        filename_prefix: options.filenamePrefix?.trim() || (references.length ? 'qwen21_edit' : 'qwen21'),
      },
    }

    return { nodes, outputs: { image: 'save' } }
  },
}

function buildSampler(options: BuildInput['options'], latent: ReturnType<typeof ref>): GraphIR['nodes'][string] {
  return {
    classType: 'KSampler',
    inputs: {
      model: ref('cache'),
      seed: options.seed,
      steps: options.steps,
      cfg: options.cfg,
      sampler_name: options.sampler,
      scheduler: options.scheduler,
      positive: ref('encode', 0),
      negative: ref('encode', 1),
      latent_image: latent,
      denoise: 1,
    },
  }
}
