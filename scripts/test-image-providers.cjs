const assert = require('node:assert/strict')
const { load } = require('./test-ts-loader.cjs')
const { imageProviders } = load('src/lib/imageProviders/index.ts')
const { resolveProvider, buildImageGraph, pickFile } = load('src/lib/imageProviders/resolve.ts')

function objectInfo(unets, clips, vaes, extraNodes = [], extra = {}) {
  const info = {
    UNETLoader: { input: { required: { unet_name: [unets, {}] } } },
    CLIPLoader: { input: { required: { clip_name: [clips, {}] } } },
    VAELoader: { input: { required: { vae_name: [vaes, {}] } } },
    CheckpointLoaderSimple: { input: { required: { ckpt_name: [[], {}] } } },
    LoraLoaderModelOnly: { input: { required: { lora_name: [[], {}] } } },
    KSampler: {}, VAEDecode: {}, SaveImage: {}, LoadImage: {}, CLIPTextEncode: {},
    EmptyLatentImage: {}, EmptySD3LatentImage: {}, EmptyFlux2LatentImage: {},
    ModelSamplingAuraFlow: {}, ImageScaleToTotalPixels: {}, GetImageSize: {},
  }
  for (const node of extraNodes) info[node] = {}
  for (const [key, value] of Object.entries(extra)) info[key] = value
  return info
}

const full = objectInfo(
  ['qwen_image_2.1_int8_convrot.safetensors', 'z_image_turbo_bf16.safetensors', 'z_image_bf16.safetensors', 'moss_image_sft_int8_convrot.safetensors', 'qwen_image_2512_fp8_e4m3fn.safetensors'],
  ['qwen3vl_8b_int8_convrot.safetensors', 'qwen_3_4b.safetensors', 'qwen_2.5_vl_7b_fp8_scaled.safetensors', 'qwen3.5_9b_w4a8_gptq.safetensors'],
  ['ae.safetensors', 'qwen_image_vae.safetensors', 'flux2-vae_small.safetensors'],
  ['TextEncodeQwenImage21', 'TextEncodeMOSSImageEdit', 'SkipLayerGuidanceDiTSimple', 'QwenImage21Cache'],
  {
    LoraLoaderModelOnly: { input: { required: { lora_name: [['moss_image_edit_lora_rank_64_bf16.safetensors'], {}] } } },
    CheckpointLoaderSimple: { input: { required: { ckpt_name: [['flux1-dev-fp8.safetensors'], {}] } } },
  },
)

const byId = Object.fromEntries(imageProviders.map((provider) => [provider.id, provider]))
assert.equal(imageProviders.length, 5, 'five image providers are ported')

for (const provider of imageProviders) {
  const resolution = resolveProvider(full, provider)
  assert.ok(resolution.available, provider.id + ' should resolve against the full fixture, missing: ' + resolution.missing.join(', '))
}
assert.equal(resolveProvider(full, byId['qwen-image-2.1']).components.diffusion, 'qwen_image_2.1_int8_convrot.safetensors')
assert.equal(resolveProvider(full, byId['qwen-image-2.1']).components.textEncoder, 'qwen3vl_8b_int8_convrot.safetensors')
assert.equal(resolveProvider(full, byId['qwen-image-2.1']).components.vae, 'qwen_image_vae.safetensors')
assert.equal(resolveProvider(full, byId['flux1-dev']).components.diffusion, 'flux1-dev-fp8.safetensors')
assert.equal(resolveProvider(full, byId['moss-image'], 'edit').components.lora, 'moss_image_edit_lora_rank_64_bf16.safetensors')

assert.equal(pickFile(['b.safetensors', 'a.safetensors'], [/^a/i, /^b/i]), 'a.safetensors')
assert.equal(pickFile(['b.safetensors'], [/^a/i, /^b/i]), 'b.safetensors')
assert.equal(pickFile([], [/^a/i]), undefined)

for (const provider of imageProviders) {
  const graph = buildImageGraph(full, provider, {
    mode: 't2i', prompt: 'a still frame', negativePrompt: '', width: 1024, height: 1024,
    steps: provider.defaults.steps ?? 25, cfg: provider.defaults.cfg ?? 1,
    sampler: provider.defaults.sampler ?? 'euler', scheduler: provider.defaults.scheduler ?? 'simple',
    seed: 7, batchSize: 1, references: [], loras: [],
  })
  const classes = Object.values(graph).map((node) => node.class_type)
  assert.ok(classes.includes('KSampler'), provider.id + ' graph has a sampler')
  assert.ok(classes.includes('SaveImage'), provider.id + ' graph has a save node')
  assert.ok(!JSON.stringify(graph).match(/[\u4e00-\u9fff]/), provider.id + ' graph must not contain CJK model input')
}

const qwenGraph = buildImageGraph(full, byId['qwen-image-2.1'], {
  mode: 't2i', prompt: 'x', negativePrompt: '', width: 1000, height: 1024,
  steps: 25, cfg: 1, sampler: 'euler', scheduler: 'simple', seed: 1, batchSize: 1, references: [], loras: [],
})
const latent = Object.values(qwenGraph).find((node) => node.class_type === 'EmptyLatentImage')
assert.equal(latent.inputs.width, 992, 'width snaps to the provider sizeStep grid')

const noQwen21 = objectInfo(
  ['z_image_turbo_bf16.safetensors'], ['qwen_3_4b.safetensors'], ['ae.safetensors'],
  ['TextEncodeQwenImage21', 'QwenImage21Cache'],
)
const qwenMissing = resolveProvider(noQwen21, byId['qwen-image-2.1'])
assert.equal(qwenMissing.available, false)
assert.ok(qwenMissing.missing.join(' ').includes('diffusion'))

const noCache = objectInfo(
  ['qwen_image_2.1_int8_convrot.safetensors'], ['qwen3vl_8b_int8_convrot.safetensors'], ['qwen_image_vae.safetensors'],
  [],
)
assert.equal(resolveProvider(noCache, byId['qwen-image-2.1']).available, false, 'QwenImage21Cache node is required')


const { studioImagePrompt, anyImageProviderAvailable, listImageProviderResolutions } = load('src/lib/imageProviders/studio.ts')
assert.ok(anyImageProviderAvailable(full))
assert.ok(!anyImageProviderAvailable(noCache), 'no provider available without the custom Qwen nodes')
assert.equal(listImageProviderResolutions(full).length, 5)

const auto = studioImagePrompt(full, null, { prompt: 'hero still', width: 768, height: 1024 })
assert.equal(auto.ok, true, auto.ok ? '' : auto.error)
assert.equal(auto.providerId, 'qwen-image-2.1', 'auto picks the first available provider')
const autoLatent = Object.values(auto.prompt).find((node) => node.class_type === 'EmptyLatentImage')
assert.equal(autoLatent.inputs.width, 768)

const explicit = studioImagePrompt(full, 'flux1-dev', { prompt: 'hero still', width: 1024, height: 1024 })
assert.equal(explicit.ok, true)
assert.ok(Object.values(explicit.prompt).some((node) => node.class_type === 'CheckpointLoaderSimple'))

const missing = studioImagePrompt(noQwen21, 'qwen-image-2.1', { prompt: 'x', width: 512, height: 512 })
assert.equal(missing.ok, false)
assert.ok(missing.error.includes('diffusion'))

process.stdout.write('PASS: image provider registry resolves against object_info and builds redline-clean graphs\n')

const { createCustomProvider, providerCatalog } = load('src/lib/imageProviders/customRegistry.ts')
const custom = createCustomProvider({ id: 'mine', name: 'My Qwen', templateId: 'qwen-image-2.1', components: { diffusion: 'my_qwen_diffusion.safetensors' } })
assert.equal(custom.id, 'custom-mine')
assert.ok(custom.custom && custom.custom.templateId === 'qwen-image-2.1')
const diffusionReq = custom.requires.find((requirement) => requirement.role === 'diffusion')
assert.ok(diffusionReq.prefer[0].test('my_qwen_diffusion.safetensors'), 'pinned diffusion file matches')
assert.ok(!diffusionReq.prefer[0].test('qwen_image_2.1_int8_convrot.safetensors'), 'pinned diffusion file is exact')
const untouched = imageProviders.find((provider) => provider.id === 'qwen-image-2.1')
assert.ok(untouched.requires.find((requirement) => requirement.role === 'diffusion').prefer[0].test('qwen_image_2.1_int8_convrot.safetensors'), 'built-in provider is not mutated')
const catalog = providerCatalog([{ id: 'mine', name: 'My Qwen', templateId: 'qwen-image-2.1', components: {} }])
assert.equal(catalog.length, 6, 'catalog is built-ins plus the custom registration')
assert.equal(catalog[catalog.length - 1].id, 'custom-mine')
