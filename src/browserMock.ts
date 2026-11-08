import type { AppSettings, DesktopApi, ModelFile } from './types'

const modelRoot = 'C:\\Users\\James\\Documents\\ComfyUI\\models'
const settings: AppSettings = {
  llmProvider: 'llama',
  comfyUrl: 'http://127.0.0.1:8188',
  ollamaUrl: 'http://127.0.0.1:11434',
  ollamaModel: 'qwen3:latest',
  lmStudioUrl: 'http://127.0.0.1:1234/api/v1/',
  lmStudioModel: '',
  llamaUrl: 'http://127.0.0.1:18434',
  llamaModel: 'Qwen3.8-27B-UD-Q4_K_M',
  llamaApiKey: '',
  modelRoot,
  paths: {
    diffusion_models: `${modelRoot}\\diffusion_models`,
    text_encoders: `${modelRoot}\\text_encoders`,
    vae: `${modelRoot}\\vae`,
    loras: `${modelRoot}\\loras`,
    vae_approx: `${modelRoot}\\vae_approx`,
    clip_vision: `${modelRoot}\\clip_vision`,
  },
  outputDirectory: 'C:\\Users\\James\\Documents\\ComfyUI\\output',
  clipMasterOutputDirectory: 'C:\\Users\\James\\Documents\\ComfyUI\\output\\video',
  ffmpegPath: 'C:\\FFMPEG\\bin\\ffmpeg.exe',
  uiScale: 100,
  attentionBackend: 'automatic',
  solAttnTau: 1,
  solCacheEnabled: true,
  h3DiffusionPrecision: 'int8',
  gpuRouting: { preset: 'automatic', strategy: 'sequential', diffusion: 'auto', textEncoder: 'auto', videoVae: 'auto', audioVae: 'auto', previewVae: 'auto', allowOvercommit: false, preloadDiffusionDuringTextEncoding: false },
  h3ParallelAttentionEnabled: false,
  experimentalLtxMsrEnabled: false,
  blurNsfwLivePreviews: false,
  queueDelaySeconds: 0,
  characterDetailReferencesEnabled: false,
    imageProviderId: 'auto',
    customImageModels: [],
  renderSettingsPresets: [],
  generationDefaults: {
    resolution: '1344x768', duration: 5, turbo: 'off', steps: 30,
    sampler: 'res_multistep', scheduler: 'simple', experimentalSampling: false,
    refImageSize: 'match', livePreview: true, sigmaShiftMode: 'model', shiftVideo: 12, shiftAudio: 3, loraStrength: 1, upscaleMode: 'refine', textEncoderPreference: 'fast', turbo8Profile: 'balanced',
  },
}

const examples: Array<[ModelFile['kind'], string, number]> = [
  ['diffusion_models', 'minimax_h3_fl2va_pruned_int8_convrot.safetensors', 20_970_379_616],
  ['diffusion_models', 'minimax_h3_ref2va_pruned_int8_convrot.safetensors', 20_970_379_616],
  ['diffusion_models', 'minimax_h3_fl2va_pruned_nvfp4.safetensors', 12_500_000_000],
  ['diffusion_models', 'minimax_h3_ref2va_pruned_nvfp4.safetensors', 12_500_000_000],
  ['diffusion_models', 'fastvideo_fasth3_8step_v2_pruned_int8_convrot.safetensors', 22_100_000_000],
  ['text_encoders', 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors', 15_687_142_551],
  ['text_encoders', 'qwen3vl_32b_minimax_h3_int8_convrot.safetensors', 27_100_000_000],
  ['vae', 'minimax_h3_video_vae_fp16.safetensors', 5_207_808_496],
  ['vae', 'minimax_h3_audio_vae_fp32.safetensors', 605_254_808],
  ['vae_approx', 'taeh3_decoder.safetensors', 39_458_084],
  ['loras', 'minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors', 1_956_192_992],
  ['loras', 'minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors', 1_956_193_000],
  ['loras', 'minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors', 1_956_193_000],
  ['loras', 'minimax_h3_ref2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors', 1_956_193_000],
  ['diffusion_models', 'ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors', 22_000_000_000],
  ['text_encoders', 'gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors', 12_000_000_000],
  ['vae', 'ltx-2.5-video-vae-bf16.safetensors', 2_000_000_000],
  ['vae', 'ltx-2.5-audio-vae-bf16.safetensors', 800_000_000],
  ['diffusion_models', 'z_image_turbo_bf16.safetensors', 12_000_000_000],
  ['diffusion_models', 'z_image_bf16.safetensors', 12_000_000_000],
  ['text_encoders', 'qwen_3_4b.safetensors', 8_000_000_000],
  ['vae', 'ae.safetensors', 350_000_000],
  ['diffusion_models', 'acestep_v1.5_xl_sft_bf16.safetensors', 8_000_000_000],
  ['diffusion_models', 'acestep_v1.5_xl_base_bf16.safetensors', 8_000_000_000],
  ['text_encoders', 'qwen_0.6b_ace15.safetensors', 1_200_000_000],
  ['text_encoders', 'qwen_4b_ace15.safetensors', 8_000_000_000],
  ['vae', 'ace_1.5_vae.safetensors', 500_000_000],
]

const ltxNodes = ['LTXVConditioning', 'LTXVEmptyLatentAudio', 'EmptyLTXVLatentVideo', 'LTXVDualCFGGuider', 'LTXVSeparateAVLatent', 'LTXVConcatAVLatent', 'LTXVLatentUpsampler', 'LTXVAudioVAEDecode', 'ManualSigmas', 'VAEEncodeTiled', 'VAEDecodeTiled', 'CLIPTextEncode', 'KSamplerSelect', 'SamplerCustomAdvanced', 'ImageFromBatch', 'RepeatImageBatch', 'ImageBatch']
const aceNodes = ['DualCLIPLoader', 'TextEncodeAceStepAudio1.5', 'EmptyAceStep1.5LatentAudio', 'ConditioningZeroOut', 'ModelSamplingAuraFlow', 'KSampler', 'VAEDecodeAudio', 'SaveAudioAdvanced']

export function installBrowserMock() {
  if (window.minimax) return
  let current = structuredClone(settings)
  const api: DesktopApi = {
    getObjectInfo: async () => Object.fromEntries([
      ...ltxNodes.map((name) => [name, { input: { required: {} } }]),
      ['LTX2SamplingPreviewOverride', { input: { required: {} } }],
      ...aceNodes.map((name) => [name, { input: { required: {} } }]),
      ['MinimaxH3LatentUpscaler3D', { input: { required: { model_name: ['COMBO', { options: ['minimax_h3_latent_upscaler_3d_fp16.safetensors'] }] } } }],
      ['LatentUpscaleModelLoader', { input: { required: { model_name: ['COMBO', { options: ['ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors'] }] } } }],
      ['UNETLoader', { input: { required: { unet_name: ['COMBO', { options: ['z_image_turbo_bf16.safetensors', 'z_image_bf16.safetensors', 'acestep_v1.5_xl_sft_bf16.safetensors', 'acestep_v1.5_xl_base_bf16.safetensors'] }] } } }],
      ['CLIPLoader', { input: { required: { clip_name: ['COMBO', { options: ['qwen_3_4b.safetensors'] }] } } }],
      ['VAELoader', { input: { required: { vae_name: ['COMBO', { options: ['ltx-2.5-video-vae-bf16.safetensors', 'ae.safetensors', 'ace_1.5_vae.safetensors'] }] } } }],
      ['SelectModelDevice', { input: { required: { model: ['MODEL'], device: [['default', 'cpu', 'gpu:0', 'gpu:1']] } } }],
      ['SelectCLIPDevice', { input: { required: { clip: ['CLIP'], device: [['default', 'cpu', 'gpu:0', 'gpu:1']] } } }],
      ['SelectVAEDevice', { input: { required: { vae: ['VAE'], device: [['default', 'gpu:0', 'gpu:1']] } } }],
      ['UpscaleModelLoader', { input: { required: { model_name: ['COMBO', { options: ['4x-UltraSharp.pth'] }] } } }],
    ]),
    uploadImageData: async () => { throw new Error('请打开桌面应用以上传图片。') },
    getOutputImage: async () => { throw new Error('请打开桌面应用以获取图片。') },
    saveComfyOutputImage: async () => { throw new Error('请打开桌面应用以保存生成的图片。') },
    saveStillImage: async () => { throw new Error('请打开桌面应用以保存生成的静帧。') },
    getSettings: async () => current,
    getLegacyMigrationStatus: async () => ({ available: false, migrated: false, needsBrowserStorageRepair: false }),
    migrateLegacyData: async () => ({ available: false, migrated: false, needsBrowserStorageRepair: false }),
    getGpuTelemetry: async () => ({ available: true, name: 'NVIDIA GeForce RTX 3090', usagePercent: 38, vramPercent: 62, vramUsedMb: 14880, vramTotalMb: 24000, devices: [{ index: 0, name: 'NVIDIA GeForce RTX 3090', usagePercent: 38, vramPercent: 62, vramUsedMb: 14880, vramTotalMb: 24000, vramFreeMb: 9120 }, { index: 1, name: 'NVIDIA GeForce RTX 5060 Ti', usagePercent: 4, vramPercent: 18, vramUsedMb: 2880, vramTotalMb: 16000, vramFreeMb: 13120 }] }),
    getRenderBenchmarks: async () => [],
    saveRenderBenchmarks: async (benchmarks) => benchmarks,
    saveSettings: async (next) => (current = next),
    factoryResetSettings: async (confirmation) => {
      if (confirmation !== 'Reset') throw new Error('请准确输入 Reset 以确认恢复出厂设置。')
      current = structuredClone(settings)
      localStorage.clear()
      location.reload()
    },
    exportWorkflowJson: async (suggestedName) => `C:\\Users\\James\\Documents\\${suggestedName}`,
    setUiScale: async (scale) => Math.round(Math.max(.75, Math.min(1.5, scale)) * 100),
    openDevTools: async () => { throw new Error('开发者工具仅在 Electron 桌面应用中可用。') },
    chooseDirectory: async () => null,
    chooseMedia: async () => null,
    chooseVideos: async () => [],
    scanModels: async () => examples.map(([kind, name, bytes]) => ({ kind, name, bytes, path: `${current.paths[kind]}\\${name}` })),
    getModelDiagnostics: async () => {
      const items = (Object.keys(current.paths) as Array<ModelFile['kind']>).map((kind) => {
        const fileCount = examples.filter(([exampleKind]) => exampleKind === kind).length
        return { kind, path: current.paths[kind], status: (fileCount > 0 ? 'ok' : 'empty') as 'ok' | 'empty', fileCount }
      })
      return {
        items,
        summary: {
          total: items.length,
          ok: items.filter((item) => item.status === 'ok').length,
          empty: items.filter((item) => item.status === 'empty').length,
          missing: 0,
          unreadable: 0,
          files: items.reduce((total, item) => total + item.fileCount, 0),
        },
      }
    },
    getComfyStatus: async () => ({ connected: false, latencyMs: 2, error: '预览模式' }),
    submitPrompt: async () => { throw new Error('桌面桥接在浏览器预览中不可用。') },
    getQueue: async () => ({}),
    getHistory: async () => ({}),
    cancelPrompt: async () => ({ cancelled: true, state: 'running' }),
    uploadInput: async () => { throw new Error('桌面桥接在浏览器预览中不可用。') },
    fileDataUrl: async () => '',
    mediaUrl: async (path) => path,
    validateMediaFiles: async (files) => files.map((file) => ({ path: file.path, valid: true })),
    extractVideoFrame: async () => { throw new Error('请打开桌面应用以提取视频帧。') },
    getVideoThumbnail: async () => { throw new Error('请打开桌面应用以创建持久化视频缩略图。') },
    extractVideoFrames: async () => { throw new Error('请打开桌面应用以提取视频帧。') },
    trimVideo: async () => { throw new Error('请打开桌面应用以裁剪参考视频。') },
    getVideoMetadata: async () => { throw new Error('请打开桌面应用以查看视频元数据。') },
    extractClipMasterFrames: async () => { throw new Error('打开桌面应用以提取 Clip Master 帧。') },
    chooseClipMasterExportPath: async () => { throw new Error('打开桌面应用以选择 Clip Master 导出位置。') },
    trimClipMaster: async () => { throw new Error('打开桌面应用以导出 Clip Master 片段。') },
    spliceClipMaster: async () => { throw new Error('打开桌面应用以导出序列。') },
    joinVideos: async () => { throw new Error('打开桌面应用以合并视频。') },
    getRifeStatus: async () => ({ installed: false }),
    installRife: async () => ({ installed: false, error: '打开桌面应用以安装 RIFE。' }),
    interpolateVideo: async () => { throw new Error('打开桌面应用以使用 RIFE 进行视频插帧。') },
    showOutput: async () => undefined,
    findLatestOutput: async () => null,
    resolveOutput: async () => null,
    getLocalLlmStatus: async (_url, provider = 'ollama') => ({ connected: true, models: provider === 'lmstudio'
      ? [{ name: 'local-vision-model', size: 0, family: 'lmstudio', parameterSize: '', local: true }]
      : [
        { name: 'qwen3:latest', size: 5_225_388_164, family: 'qwen3', parameterSize: '8.2B', local: true },
        { name: 'llama3.1:8b', size: 4_920_753_328, family: 'llama', parameterSize: '8.0B', local: true },
      ] }),
    generateWithOllama: async (_url, _model, _prompt, _provider, onUpdate) => { const content = 'A cinematic wide shot with deliberate subject motion, controlled camera movement, natural lighting, and synchronized environmental audio.'; onUpdate?.({ thinking: '正在检查场景的镜头运动是否清晰、连续。', content: '' }); onUpdate?.({ thinking: '正在检查场景的镜头运动是否清晰、连续。', content }); return content },
    generatePromptCompletion: async () => 'with a slow, steady camera move.',
    generateWithOllamaVision: async () => 'A MiniMax-ready prompt grounded in the visible identity, composition, lighting, and continuity details of the supplied reference images.',
    generateStructuredWithOllama: async (_url, _model, prompt, schema, _provider, _images, onUpdate) => {
      const properties = schema.properties as Record<string, unknown> | undefined
      if (properties?.operation) {
        const request = prompt.match(/REQUEST:\n([\s\S]*?)(?:\n\n(?:RECENT CONVERSATION|Return exactly)|$)/)?.[1] ?? prompt
        const asksQuestion = /\?\s*$/.test(request) || /^(?:what|why|how|can you explain|should we|review|analyze)\b/i.test(request)
        const asksForImage = /\b(?:still image|image prompt|z-image|text-to-image)\b/i.test(request)
        const directEdit = /\b(?:write|create|make|generate|draft|rewrite|enhance|revise|improve|build|add|change|replace|remove|have|show|set|turn|keep)\b/i.test(request)
        const imagePrompt = /For a direct request to create or edit an active still image/i.test(prompt) && asksForImage && directEdit && !asksQuestion
        const videoPrompt = !imagePrompt && /For a direct request to create or edit this active video/i.test(prompt) && directEdit && !asksQuestion
        const intent = imagePrompt ? 'image' : videoPrompt ? 'video' : 'text'
        const operation = intent === 'image' ? 'replace' : intent === 'video' ? /\b(?:rewrite|replace|change|remove|revise|improve|enhance|polish|refine)\b|\bmake\b.*\bbetter\b/i.test(request) ? 'replace' : 'append' : 'none'
        const duration = prompt.match(/full (\d+(?:\.\d+)?) second/)?.[1] ?? '5.0'
        const reply = imagePrompt
          ? `A still image prompt following the request: ${request}`
          : videoPrompt && operation === 'replace'
            ? `0.0–2.0s: Establish the requested starting state with a steady camera.\n2.0–${duration}s: Complete the requested action with natural movement and settle on the final pose.`
            : videoPrompt
              ? `Addendum: ${request}`
              : '我可以帮你处理当前工作区。告诉我你想要的更改，我会照做。'
        return { reply, operation, intent }
      }
      if (properties?.direction) {
        const draft = prompt.match(/DRAFT:\n([\s\S]*?)(?:\n\nReturn the required structured fields|$)/)?.[1]?.trim()
        onUpdate?.({ thinking: '正在检查已创作的场景、时间线和参考约束。', content: '' })
        return {
          summary: 'A clear, continuous shot that preserves the authored scene and its constraints.',
          direction: draft ? `Clarify the authored scene in concrete, observable terms while preserving every requested detail. ${draft}` : 'A single, continuous cinematic shot with physically coherent subject movement and synchronized natural sound.',
        }
      }
      if (properties?.reply) {
        const filmmakerRequest = prompt.match(/FILMMAKER: ([\s\S]*)$/)?.[1] ?? prompt
        const buildAssets = /Create the recurring characters/i.test(filmmakerRequest)
        const buildStory = /Build a complete story treatment/i.test(filmmakerRequest)
        const buildShots = /Turn the story into connected scenes/i.test(filmmakerRequest)
        const removeFirstCharacter = /(?:remove|delete) (?:the )?(?:first )?character/i.test(filmmakerRequest)
        const contextMatch = prompt.match(/PROJECT CONTEXT: (.+)\n\nFILMMAKER:/)
        const currentContext = contextMatch ? JSON.parse(contextMatch[1]) as { project: Record<string, unknown>; characters?: Array<{ id: string; name?: string }> } : { project: {} }
        const currentProject = currentContext.project
        const removedCharacter = removeFirstCharacter ? currentContext.characters?.[0] : undefined
        return {
          reply: removedCharacter ? `## Character removal prepared\nReview the removal of **${removedCharacter.name ?? '所选角色'}** before applying it.` : buildAssets ? '## Production bible created\n- Added **Mara Vale** as the continuity anchor.\n- Added `North Relay Station` as the recurring set.\n\nReview the new cards before adding reference images.' : buildStory ? '## Story treatment created\nA courier crosses a flooded city before sunrise, carrying the final radio capable of reconnecting the evacuation fleet.' : buildShots ? '## Shot plan created\n- Added an opening scene and a production-ready MiniMax establishing shot.\n- Later connected scenes can inherit its final frame.' : '## Continuity approach\n- Carry the prior scene’s **last frame** into the connected shot.\n- Preserve wardrobe, screen direction, lighting, and motion momentum.',
          changes: removedCharacter ? [`Removed character ${removedCharacter.name ?? removedCharacter.id}.`] : buildAssets ? ['已创建角色 Mara Vale。', '已创建地点 North Relay Station。'] : buildStory ? ['已创建完整的故事大纲。'] : buildShots ? ['已创建开场场景。', '已创建其建立镜头。'] : [], focusAreas: buildAssets || removedCharacter ? ['bible'] : buildStory ? ['setup'] : ['shots'],
          projectPatch: {
            title: currentProject.title ?? '未命名电影', targetRuntime: currentProject.targetRuntime ?? 60,
            computeBudgetMinutes: currentProject.computeBudgetMinutes ?? 120, aspectRatio: currentProject.aspectRatio ?? '16:9',
            genre: currentProject.genre ?? '', visualStyle: currentProject.visualStyle ?? '',
            story: buildStory ? 'A courier crosses a flooded city before sunrise, carrying the final radio capable of reconnecting the evacuation fleet. Pursued across collapsing rooftops, she reaches the harbor tower and transmits just as dawn breaks.' : currentProject.story ?? '', visualRules: currentProject.visualRules ?? '',
          },
          characterUpserts: buildAssets ? [{ id: 'new-mara', name: 'Mara Vale', description: 'A weathered pilot in her late thirties with cropped black hair and a narrow scar above her left eyebrow.', wardrobe: '褪色的炭灰色飞行夹克、锈红色围巾、工具腰带、黄铜罗盘。', voiceNotes: 'Low warm alto with a measured pace.' }] : [], characterDeletes: removedCharacter ? [removedCharacter.id] : [],
          locationUpserts: buildAssets ? [{ id: 'new-relay', name: '北方中继站', description: 'An isolated concrete relay station with oxidized antenna ribs, amber work lights, and a cracked blue orientation stripe.' }] : [], locationDeletes: [],
          sceneUpserts: buildShots ? [{ id: 'new-opening', title: 'Flooded crossing', summary: '信使进入沉没之城，踏上了危险的路线。', locationId: '', transition: 'cut' }] : [], sceneDeletes: [],
          shotUpserts: buildShots ? [{ id: 'new-establishing', sceneId: 'new-opening', title: '城市初晓', prompt: 'Wide cinematic view of a lone courier crossing a flooded avenue before sunrise, skiffs drifting between dark towers, slow crane movement forward, cold blue ambient light with distant amber windows, wind and water synchronized.', dialogue: '', duration: 6, mode: currentContext.characters?.[0] ? 'reference' : 'text', characterIds: currentContext.characters?.[0] ? [currentContext.characters[0].id] : [] }] : [], shotDeletes: [],
        }
      }
      if (properties?.wardrobe) return { name: 'Mara Vale', description: 'A weathered pilot in her late thirties with cropped black hair, a narrow scar above her left eyebrow, and a steady watchful posture.', wardrobe: '褪色的炭灰色飞行夹克、锈红色围巾、工具腰带、黄铜罗盘。', voiceNotes: '低沉温暖的中音，节奏沉稳，干涩的演绎在压力下愈发紧绷。' }
      if (properties?.description && !properties?.scenes) return { name: '北方中继站', description: 'An isolated concrete relay station on a wind-cut plateau, with a circular control room, oxidized antenna ribs, amber work lights, and a cracked blue orientation stripe running through every corridor.' }
      return { scenes: [{ title: 'Opening', summary: '故事开始。', location: '主要场景', shots: [{ title: '建立镜头', duration: 5, prompt: '以电影感的全景镜头引入场景，配合可控的镜头运动和自然同步的环境音。', dialogue: '', mode: 'text', characters: [] }] }] }
    },
    getLanStatus: async () => ({ running: true, url: `${location.origin}/?mobile=1&token=browser-preview`, desktopUrl: `${location.origin}/?desktop=1&token=browser-preview`, port: Number(location.port) }),
    syncMobileCharacters: async (characters) => ({ synced: characters.length }),
    rotateLanToken: async () => ({ running: true, url: `${location.origin}/?mobile=1&token=browser-preview`, desktopUrl: `${location.origin}/?desktop=1&token=browser-preview`, port: Number(location.port) }),
    setWindowAlwaysOnTop: async (enabled) => enabled,
    openStudio: async () => { if (window.opener && !window.opener.closed) window.opener.focus(); else window.open(location.pathname, 'oyama-studio') },
    openMovieEditor: async () => { window.open(`${location.pathname}?movieEditor=1`, 'oyama-ai-movie', 'popup=yes,width=1440,height=920,resizable=yes') },
    exportVideo: async () => { throw new Error('视频导出需要桌面应用。') },
    prepareContinuationSource: async (sources) => sources[0],
    prepareRippleChunkSource: async (source) => source,
    assembleRippleChunks: async () => ({ path: 'C:/oyama-ui-e2e/ripple-long.mp4', name: 'ripple-long.mp4' }),
  }
  window.minimax = api
}
