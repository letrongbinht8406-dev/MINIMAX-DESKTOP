import { ref, type GraphIR } from '../ir'
import { chainUserLoras, remotePath, type BuildInput, type ModelProvider } from '../provider'
import { defaultImageOptions, type ImageOptions } from '../types'

/**
 * MOSS-Image — text to image, and instruction editing.
 *
 * Text-to-image mirrors Comfy-Org's `image_moss_image_t2i.json`: plain KSampler
 * with er_sde / cfg 2.5, Flux-2 latent space and the small Flux-2 VAE.
 *
 * Editing mirrors `image_moss_image_edit.json`: an edit LoRA on top of the SFT
 * checkpoint, the source scaled to 1 MP, and both conditioning branches encoded
 * by `TextEncodeMOSSImageEdit` against that same reference. `edit_format` must
 * match the LoRA it was trained with — `Moss-Image-Edit` here. Getting it wrong
 * still returns an image, but identity and framing drift.
 */
export const mossImage: ModelProvider = {
  id: 'moss-image',
  label: 'MOSS-Image',
  family: 'MOSS',
  description: 'Flux-2 潜空间，er_sde 采样，cfg 2.5，负向提示词有效',
  modality: 'image',
  capabilities: ['t2i', 'edit'],
  requiresNodes: [
    'UNETLoader',
    'CLIPLoader',
    'VAELoader',
    'CLIPTextEncode',
    'EmptyFlux2LatentImage',
    'KSampler',
    'VAEDecode',
    'SaveImage',
    'LoadImage',
    'ImageScaleToTotalPixels',
    'GetImageSize',
    'TextEncodeMOSSImageEdit',
    'LoraLoaderModelOnly',
    'SkipLayerGuidanceDiTSimple',
  ],
  requires: [
    {
      role: 'diffusion',
      node: 'UNETLoader',
      field: 'unet_name',
      prefer: [/^moss_image_sft.*\.safetensors$/i, /^moss_image.*\.safetensors$/i, /moss.?image/i],
      hint: 'moss_image_sft_int8_convrot.safetensors',
    },
    {
      role: 'textEncoder',
      node: 'CLIPLoader',
      field: 'clip_name',
      prefer: [/^qwen3\.5_9b.*\.safetensors$/i, /^qwen3\.5.*\.safetensors$/i, /^qwen3.*\.safetensors$/i],
      hint: 'qwen3.5_9b_w4a8_gptq.safetensors',
    },
    {
      role: 'vae',
      node: 'VAELoader',
      field: 'vae_name',
      prefer: [/^flux2-vae_small.*\.safetensors$/i, /^flux2-vae.*\.safetensors$/i],
      hint: 'flux2-vae_small.safetensors',
    },
  ],
  modeRequires: {
    edit: [
      {
        role: 'lora',
        node: 'LoraLoaderModelOnly',
        field: 'lora_name',
        prefer: [/^moss_image_edit_lora_rank_64.*\.safetensors$/i, /moss_image_edit_lora/i],
        hint: 'moss_image_edit_lora_rank_64_bf16.safetensors',
      },
    ],
  },
  defaults: { ...defaultImageOptions, steps: 25, cfg: 2.5, sampler: 'er_sde', scheduler: 'simple' },
  modeDefaults: {
    // The edit LoRA author ships 30 steps / cfg 4 / euler / normal.
    edit: { steps: 30, cfg: 4, sampler: 'euler', scheduler: 'normal' },
  },
  constraints: { steps: [1, 80], cfg: [1, 10], maxBatch: 8, sizeStep: 16, maxSide: 2048, maxReferences: 1 },

  build({ options, components }: BuildInput): GraphIR {
    const references = options.mode === 'edit' ? options.references : []
    if (references.length) return buildEdit(options, components, remotePath(references[0]))

    const nodes: GraphIR['nodes'] = {
      diffusion: {
        classType: 'UNETLoader',
        inputs: { unet_name: components.diffusion, weight_dtype: 'default' },
      },
      textEncoder: {
        classType: 'CLIPLoader',
        inputs: { clip_name: components.textEncoder, type: 'moss_image', device: 'default' },
      },
      vae: { classType: 'VAELoader', inputs: { vae_name: components.vae } },
      positive: {
        classType: 'CLIPTextEncode',
        inputs: { text: options.prompt, clip: ref('textEncoder') },
      },
      negative: {
        classType: 'CLIPTextEncode',
        inputs: { text: options.negativePrompt, clip: ref('textEncoder') },
      },
      latent: {
        classType: 'EmptyFlux2LatentImage',
        inputs: { width: options.width, height: options.height, batch_size: options.batchSize },
      },
      decode: { classType: 'VAEDecode', inputs: { samples: ref('sampler'), vae: ref('vae') } },
      save: { classType: 'SaveImage', inputs: { images: ref('decode'), filename_prefix: options.filenamePrefix?.trim() || 'moss' } },
    }

    // Built after the literal: chainUserLoras needs the node map it writes into.
    nodes.sampler = {
      classType: 'KSampler',
      inputs: {
        model: chainUserLoras(nodes, ref('diffusion'), options.loras),
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

function buildEdit(options: ImageOptions, components: BuildInput['components'], source: string): GraphIR {
  const nodes: GraphIR['nodes'] = {
    diffusion: {
      classType: 'UNETLoader',
      inputs: { unet_name: components.diffusion, weight_dtype: 'default' },
    },
    lora: {
      classType: 'LoraLoaderModelOnly',
      inputs: { model: ref('diffusion'), lora_name: components.lora, strength_model: 1 },
    },
    // Guidance sits on the LoRA-patched model, before the sampler sees it.
    guidance: {
      classType: 'SkipLayerGuidanceDiTSimple',
      inputs: { model: ref('lora'), double_layers: '', single_layers: '22', start_percent: 0, end_percent: 1 },
    },
    textEncoder: {
      classType: 'CLIPLoader',
      inputs: { clip_name: components.textEncoder, type: 'moss_image', device: 'default' },
    },
    vae: { classType: 'VAELoader', inputs: { vae_name: components.vae } },
    source: { classType: 'LoadImage', inputs: { image: source } },
    scale: {
      classType: 'ImageScaleToTotalPixels',
      inputs: { image: ref('source'), upscale_method: 'lanczos', megapixels: 1, resolution_steps: 16 },
    },
    // The latent must match the scaled source, so its size is read from the
    // image itself rather than from the UI fields.
    size: { classType: 'GetImageSize', inputs: { image: ref('scale') } },
    latent: {
      classType: 'EmptyFlux2LatentImage',
      inputs: { width: ref('size', 0), height: ref('size', 1), batch_size: 1 },
    },
    positive: {
      classType: 'TextEncodeMOSSImageEdit',
      inputs: {
        clip: ref('textEncoder'),
        vae: ref('vae'),
        prompt: options.prompt,
        edit_format: 'Moss-Image-Edit',
        image_strength: 1,
        'images.image_0': ref('scale'),
      },
    },
    negative: {
      classType: 'TextEncodeMOSSImageEdit',
      inputs: {
        clip: ref('textEncoder'),
        vae: ref('vae'),
        prompt: options.negativePrompt || 'nsfw, worst quality, bad anatomy, watermark, jpeg artifact',
        edit_format: 'Moss-Image-Edit',
        image_strength: 1,
        'images.image_0': ref('scale'),
      },
    },
    sampler: {
      classType: 'KSampler',
      inputs: {
        model: ref('guidance'),
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
    },
    decode: { classType: 'VAEDecode', inputs: { samples: ref('sampler'), vae: ref('vae') } },
    save: { classType: 'SaveImage', inputs: { images: ref('decode'), filename_prefix: options.filenamePrefix?.trim() || 'moss_edit' } },
  }

  // User LoRAs go after the edit LoRA (that one is part of the recipe) and before
  // the guidance patch, so the patch still sees the final model.
  nodes.guidance.inputs.model = chainUserLoras(nodes, ref('lora'), options.loras)

  return { nodes, outputs: { image: 'save' } }
}
