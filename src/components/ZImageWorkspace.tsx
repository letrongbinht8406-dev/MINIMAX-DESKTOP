import { PreviewPanel, ProductionLoading } from './Workspace'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, CircleStop, Dices, Film, Gauge, ImagePlus, LoaderCircle, Pin, Sparkles, WandSparkles } from 'lucide-react'
import { buildZImage, ZIMAGE_DEFAULT_NEGATIVE_PROMPT, type ZImageVariant } from '../lib/zimage'
import { imageProviders, providerCatalog } from '../lib/imageProviders/index'
import { loadFilePins, saveFilePin, clearFilePin, resolvePinnedProvider } from '../lib/zimagePin'
import type { ModelProvider } from '../lib/imageProviders/provider'
import type { CustomImageModel } from '../lib/imageProviders/customRegistry'
import { buildImageGraph, resolveProvider } from '../lib/imageProviders/resolve'
import type { ComfyPrompt } from '../lib/workflow'
import { choices, type ObjectInfo } from '../lib/comfyInfo'
import { RenderSize } from './RenderSize'
import { SmartPromptEditor } from './SmartPromptEditor'
import type { MediaFile, WorkflowGpuRouting } from '../types'
import { useLivePreview, type LiveProgress } from '../lib/useLivePreview'

type StoredWorkspace = {
  prompt: string
  negativePrompt: string
  negativePromptInitialized: boolean
  resolution: string
  variant: ZImageVariant
  providerId: string
  sampler: string
  scheduler: string
  model: string
  encoder: string
  vae: string
  seed: number
  steps: number
  guidance: number
  livePreview: boolean
  pinRestored?: boolean
}

const defaults: StoredWorkspace = {
  prompt: '',
  negativePrompt: ZIMAGE_DEFAULT_NEGATIVE_PROMPT,
  negativePromptInitialized: true,
  resolution: '1344x768',
  variant: 'turbo',
  providerId: 'zimage',
  sampler: 'res_multistep',
  scheduler: 'simple',
  model: 'z_image_turbo_bf16.safetensors',
  encoder: 'qwen_3_4b.safetensors',
  vae: 'ae.safetensors',
  seed: Math.floor(Math.random() * 1_000_000_000),
  steps: 8,
  guidance: 1,
  livePreview: true,
}

function readWorkspace(catalog: ModelProvider[] = imageProviders): StoredWorkspace {
  try {
    const saved = JSON.parse(localStorage.getItem('minimax.zimage-workspace') ?? '{}') as Partial<StoredWorkspace>
    const negativePrompt = saved.negativePromptInitialized || saved.negativePrompt?.trim()
      ? saved.negativePrompt ?? ZIMAGE_DEFAULT_NEGATIVE_PROMPT
      : ZIMAGE_DEFAULT_NEGATIVE_PROMPT
    const providerId = typeof saved.providerId === 'string' && (saved.providerId === 'zimage' || catalog.some((provider) => provider.id === saved.providerId)) ? saved.providerId : 'zimage'
    const pins = loadFilePins()
    const lastFile = localStorage.getItem('zimage.last-file.v1') ?? ''
    const pinnedId = resolvePinnedProvider(pins, catalog, lastFile, providerId)
    const filePin = pinnedId !== providerId ? pins[lastFile] : undefined
    return {
      ...defaults,
      ...saved,
      providerId: pinnedId,
      ...(filePin ? { steps: filePin.steps, guidance: filePin.cfg, seed: filePin.seed, resolution: filePin.resolution } : {}),
      pinRestored: Boolean(filePin),
      negativePrompt,
      negativePromptInitialized: true,
      variant: saved.variant === 'base' ? 'base' : 'turbo',
    }
  }
  catch { return defaults }
}

const isZImageModel = (name: string) => /z[_\s-]?image/i.test(name)
const isTurboModel = (name: string) => isZImageModel(name) && /turbo/i.test(name)
const isBaseModel = (name: string) => isZImageModel(name) && !/turbo/i.test(name)
const preferredModel = (models: string[], variant: ZImageVariant) => models.find(variant === 'turbo' ? isTurboModel : isBaseModel)
  ?? (variant === 'turbo' ? 'z_image_turbo_bf16.safetensors' : 'z_image_bf16.safetensors')

type ZImageJob = { id: string; url: string }
type HistoryEntry = {
  status?: { status_str?: string }
  outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }>
}

export function ZImageWorkspace({
  url, info, connected, ollamaAvailable, llmProvider, ollamaUrl, ollamaModel, outputDirectory, attentionBackend, gpuRouting, customModels, onUse, onUseLtx,
}: {
  url: string
  info: ObjectInfo
  connected: boolean
  ollamaAvailable: boolean
  llmProvider: 'ollama' | 'lmstudio' | 'llama'
  ollamaUrl: string
  ollamaModel: string
  outputDirectory: string
  attentionBackend?: string
  gpuRouting?: WorkflowGpuRouting
  customModels?: CustomImageModel[]
  onUse(file: MediaFile, resolution: string): void
  onUseLtx(file: MediaFile): void
}) {
  const catalog = useMemo(() => providerCatalog(customModels ?? []), [customModels])
  const initial = useMemo(() => readWorkspace(catalog), [catalog])
  const [prompt, setPrompt] = useState(initial.prompt)
  const [negativePrompt, setNegativePrompt] = useState(initial.negativePrompt)
  const [resolution, setResolution] = useState(initial.resolution)
  const [variant, setVariant] = useState<ZImageVariant>(initial.variant)
  const [providerId, setProviderId] = useState(initial.providerId)
  const [sampler, setSampler] = useState(initial.sampler)
  const [scheduler, setScheduler] = useState(initial.scheduler)
  const [model, setModel] = useState(initial.model)
  const [encoder, setEncoder] = useState(initial.encoder)
  const [vae, setVae] = useState(initial.vae)
  const [seed, setSeed] = useState(initial.seed)
  const [steps, setSteps] = useState(initial.steps)
  const [guidance, setGuidance] = useState(initial.guidance)
  const [livePreview, setLivePreview] = useState(initial.livePreview)
  const [job, setJob] = useState<ZImageJob | null>(null)
  const [result, setResult] = useState<MediaFile | null>(null)
  const [pinMap, setPinMap] = useState<Record<string, import('../lib/zimagePin').ZImageFilePin>>(() => loadFilePins(localStorage))

  // pin 恢复只改 providerId/steps/cfg/seed/resolution；model/encoder/vae 仍是上一个 provider 会话里存的值。
  // 等 object_info 就绪后按 pin 的 provider 重新解析组件（与 switchProvider 同一逻辑），避免跨 provider 组件错位。
  const pinAlignedRef = useRef(false)
  useEffect(() => {
    if (pinAlignedRef.current || !initial.pinRestored) return
    if (!info || Object.keys(info).length === 0) return
    pinAlignedRef.current = true
    const provider = catalog.find((candidate) => candidate.id === initial.providerId)
    if (!provider) return
    const resolution = resolveProvider(info, provider)
    if (resolution.components.diffusion) setModel(String(resolution.components.diffusion))
    if (resolution.components.textEncoder) setEncoder(String(resolution.components.textEncoder))
    if (resolution.components.vae) setVae(String(resolution.components.vae))
  }, [catalog, info, initial])
  const [busy, setBusy] = useState(false)
  const [assisting, setAssisting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const jobRef = useRef<ZImageJob | null>(null)
  const [liveProgress, setLiveProgress] = useState<LiveProgress | null>(null)
  const liveProgressRef = useRef<LiveProgress | null>(null)
  const onLiveProgress = useCallback((id: string, update: LiveProgress) => {
    if (jobRef.current?.id === id) { liveProgressRef.current = update; setLiveProgress(update) }
  }, [])
  const live = useLivePreview(url, connected, onLiveProgress)

  const updateJob = useCallback((next: ZImageJob | null) => {
    jobRef.current = next
    setJob(next)
  }, [])

  useEffect(() => {
    const loadPrompt = (event: Event) => {
      const value = (event as CustomEvent<string>).detail
      if (value?.trim()) { setPrompt(value.trim()); setMessage('已从 Studio copilot 加载图像提示词。'); setError(false) }
    }
    window.addEventListener('minimax:load-image-prompt', loadPrompt)
    return () => window.removeEventListener('minimax:load-image-prompt', loadPrompt)
  }, [])

  useEffect(() => {
    localStorage.setItem('minimax.zimage-workspace', JSON.stringify({ prompt, negativePrompt, negativePromptInitialized: true, resolution, variant, providerId, sampler, scheduler, model, encoder, vae, seed, steps, guidance, livePreview }))
  }, [encoder, guidance, livePreview, model, negativePrompt, prompt, providerId, resolution, sampler, scheduler, seed, steps, vae, variant])

  useEffect(() => {
    if (!job) return
    let disposed = false
    let timer: ReturnType<typeof setTimeout>
    let completedWithoutOutputPolls = 0
    const poll = async () => {
      try {
        const history = await window.minimax.getHistory(job.url, job.id)
        const entry = history[job.id] as HistoryEntry | undefined
        if (entry?.status?.status_str === 'error') throw new Error('图像生成失败。请检查所选模型组件和 ComfyUI 日志。')
        // The workflow's SaveImage is node 10. Prefer it so a preview-node
        // temporary image can never be mistaken for the production output.
        const image = entry?.outputs?.['10']?.images?.[0]
          ?? Object.values(entry?.outputs ?? {}).flatMap((output) => output.images ?? [])[0]
        if (image) {
          const preview = await window.minimax.getOutputImage(job.url, image)
          const saved = await window.minimax.saveComfyOutputImage(job.url, image, outputDirectory, 'image-creation')
          if (!disposed) {
            setResult({ ...saved, preview, kind: 'image' })
            if (selectedProvider && saved.name) {
              setPinMap(saveFilePin({ fileId: saved.name, providerId: selectedProvider.id, steps, cfg: guidance, seed, resolution, pinnedAt: Date.now() }, localStorage))
              localStorage.setItem('zimage.last-file.v1', saved.name)
            }
            updateJob(null); setBusy(false); setError(false); liveProgressRef.current = null; setLiveProgress(null); setMessage('图像生成完成，可以使用。')
          }
          return
        }
        if (entry?.status?.status_str === 'success') {
          completedWithoutOutputPolls += 1
          if (completedWithoutOutputPolls > 2) throw new Error('ComfyUI 已完成图像生成但未返回已保存的图片。请检查 SaveImage 节点和 ComfyUI 日志。')
          if (!disposed) setMessage('ComfyUI 已完成；正在收集已保存的图像…')
        } else if (!disposed) {
          setMessage(liveProgressRef.current?.label ?? '正在 ComfyUI 中渲染图像…')
        }
      } catch (caught) {
        if (!disposed) { setMessage(caught instanceof Error ? caught.message : String(caught)); setError(true); setBusy(false); liveProgressRef.current = null; setLiveProgress(null); updateJob(null) }
        return
      }
      if (!disposed) timer = setTimeout(poll, 2000)
    }
    void poll()
    return () => { disposed = true; clearTimeout(timer) }
  // 生成期间 provider/参数被 UI 锁定（busy 时控件禁用），poll effect 捕获的即为提交时的值；
  // pin 保存依赖这批值，故在 deps 行显式豁免 exhaustive-deps（加入 deps 会重启动 poll 状态机）。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, outputDirectory, updateJob])

  const installedModels = choices(info, 'UNETLoader', 'unet_name')
  const turboInstalled = installedModels.some(isTurboModel)
  const baseInstalled = installedModels.some(isBaseModel)
  const modelMatchesVariant = variant === 'turbo' ? isTurboModel(model) : isBaseModel(model)
  const available = installedModels.includes(model) && modelMatchesVariant
    && choices(info, 'CLIPLoader', 'clip_name').includes(encoder)
    && choices(info, 'VAELoader', 'vae_name').includes(vae)
  const switchVariant = (next: ZImageVariant) => {
    if (busy || next === variant) return
    setVariant(next)
    setModel(preferredModel(installedModels, next))
    setSteps(next === 'turbo' ? 8 : 40)
    setGuidance(next === 'turbo' ? 1 : 4)
    setMessage(next === 'turbo' ? '已选择极速模式：快速 8 步生成。' : '已选择原始 Z-Image：40 步精细模式，支持 CFG 和负面提示词。')
    setError(false)
  }
  const switchProvider = (nextId: string) => {
    if (busy || nextId === providerId) return
    setProviderId(nextId)
    const provider = catalog.find((candidate) => candidate.id === nextId)
    if (provider) {
      const resolution = resolveProvider(info, provider)
      const preset = provider.defaults
      setSteps(preset.steps ?? 25); setGuidance(preset.cfg ?? 1); setSampler(preset.sampler ?? 'euler'); setScheduler(preset.scheduler ?? 'simple')
      if (resolution.components.diffusion) setModel(String(resolution.components.diffusion))
      if (resolution.components.textEncoder) setEncoder(String(resolution.components.textEncoder))
      if (resolution.components.vae) setVae(String(resolution.components.vae))
      setMessage('已切换图像模型：' + provider.label + (resolution.available ? '。' : '；缺少 ' + resolution.missing.join('，') + '。'))
    } else {
      setModel(preferredModel(installedModels, variant))
      setEncoder('qwen_3_4b.safetensors'); setVae('ae.safetensors')
      setSteps(variant === 'turbo' ? 8 : 40); setGuidance(variant === 'turbo' ? 1 : 4)
      setSampler('res_multistep'); setScheduler('simple')
      setMessage('已切回 Z-Image 内置管线。')
    }
    setError(false)
  }
  const fields = [
    { key: 'diffusion', label: 'Z-Image 模型', value: model, set: setModel, node: 'UNETLoader', field: 'unet_name' },
    { key: 'textEncoder', label: '文本编码器', value: encoder, set: setEncoder, node: 'CLIPLoader', field: 'clip_name' },
    { key: 'vae', label: '图像 VAE', value: vae, set: setVae, node: 'VAELoader', field: 'vae_name' },
  ]
  const selectedProvider = catalog.find((provider) => provider.id === providerId)
  const selectedResolution = selectedProvider ? resolveProvider(info, selectedProvider) : null
  const providerOptions = [
    { id: 'zimage', label: variant === 'turbo' ? 'Z-Image 内置管线（Turbo）' : 'Z-Image 内置管线（基础）', available },
    ...catalog.map((provider) => {
      const resolution = resolveProvider(info, provider)
      return { id: provider.id, label: provider.label, available: resolution.available }
    }),
  ]
  const activeAvailable = selectedResolution ? selectedResolution.available : available
  const componentFields = selectedProvider
    ? selectedProvider.requires.filter((requirement) => requirement.role === 'diffusion' || requirement.role === 'textEncoder' || requirement.role === 'vae').map((requirement) => ({
        key: requirement.role,
        label: requirement.role === 'diffusion' ? '扩散模型' : requirement.role === 'textEncoder' ? '文本编码器' : '图像 VAE',
        value: requirement.role === 'diffusion' ? model : requirement.role === 'textEncoder' ? encoder : vae,
        set: requirement.role === 'diffusion' ? setModel : requirement.role === 'textEncoder' ? setEncoder : setVae,
        node: requirement.node,
        field: requirement.field,
      }))
    : fields
  const stepBounds: [number, number] = selectedProvider ? ((selectedProvider.constraints?.steps as [number, number] | undefined) ?? [1, 80]) : variant === 'turbo' ? [4, 20] : [28, 50]
  const cfgBounds: [number, number] = selectedProvider ? ((selectedProvider.constraints?.cfg as [number, number] | undefined) ?? [1, 10]) : variant === 'turbo' ? [1, 3] : [3, 5]

  const create = async () => {
    if (!connected || !activeAvailable || !prompt.trim()) return
    setBusy(true); setResult(null); setError(false); liveProgressRef.current = null; setLiveProgress(null); setMessage(`正在提交${selectedProvider?.label ?? (variant === 'turbo' ? 'Z-Image 内置管线（Turbo）' : 'Z-Image 内置管线（基础）')} 工作流…`)
    try {
      const [width, height] = resolution.split('x').map(Number)
      let graph: ComfyPrompt
      if (selectedProvider) {
        graph = buildImageGraph(info, selectedProvider, {
          mode: 't2i',
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim(),
          width,
          height,
          steps,
          cfg: guidance,
          seed,
          sampler,
          scheduler,
          batchSize: 1,
          references: [],
          loras: [],
          filenamePrefix: 'oyama_image',
        }) as unknown as ComfyPrompt
      } else {
        graph = buildZImage(prompt.trim(), width, height, seed, model, encoder, vae, steps, guidance, variant, variant === 'base' ? negativePrompt.trim() : '', attentionBackend, gpuRouting, livePreview)
      }
      const response = await window.minimax.submitPrompt(url, graph, live.clientId)
      live.registerWorkflow(response.prompt_id, graph, livePreview)
      if (!selectedProvider && gpuRouting) console.info('[GPU Routing] Z-Image component routing enabled.', gpuRouting)
      updateJob({ id: response.prompt_id, url })
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught)); setError(true); setBusy(false)
    }
  }

  const cancel = async () => {
    if (!job) return
    try {
      await window.minimax.cancelPrompt(job.url, job.id)
      setMessage('图像生成已取消。'); setError(false)
    } catch (caught) {
      setMessage(`取消失败：${caught instanceof Error ? caught.message : String(caught)}`); setError(true)
    } finally { updateJob(null); setBusy(false); liveProgressRef.current = null; setLiveProgress(null) }
  }

  const enhance = async () => {
    if (!ollamaAvailable || !prompt.trim() || assisting) return
    setAssisting(true); setError(false); setMessage('正在请求本地提示词助手…')
    try {
      const instruction = `Rewrite this as one polished still-image prompt for ${selectedProvider?.label ?? (variant === 'turbo' ? 'Z-Image Turbo' : '原始 Z-Image 基础模型')}. Preserve the subject and intent while improving composition, lens, lighting, environment, texture, color, and clarity. Do not describe motion, sound, timelines, or multiple shots. Return only the finished prompt.\n\nDRAFT:\n${prompt.trim()}`
      setPrompt(await window.minimax.generateWithOllama(ollamaUrl, ollamaModel, instruction, llmProvider))
      setMessage('提示词已在本地增强。生成前请检查。')
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : String(caught)); setError(true) }
    finally { setAssisting(false) }
  }

  const visibleLivePreview = livePreview && busy && job && live.preview?.promptId === job.id ? live.preview : null

  return <div className="standard-page zimage-workspace">
    <div className="page-heading">
      <div><p className="eyebrow">CREATE · Z‑IMAGE</p><h1>图像创建</h1><p>用聚焦的图像控件设计可直接投产的静帧与开场帧。</p></div>
      <div className="heading-state"><span className={connected && activeAvailable ? 'ok' : 'warn'}>{connected && activeAvailable ? <Check size={15} /> : <AlertCircle size={15} />}{connected ? activeAvailable ? selectedProvider ? selectedProvider.label + ' 就绪' : variant === 'turbo' ? '极速模式就绪' : '原始模式就绪' : (selectedProvider ? selectedProvider.label : variant === 'turbo' ? 'Turbo' : '原始模式') + ' 缺少模型' : '引擎离线'}</span></div>
    </div>

    <div className="zimage-workspace-grid">
      <section className="zimage-composer">
        <div className="field-group">
          <div className="field-label"><label htmlFor="zimage-provider">图像模型</label><span>{selectedProvider?.description ?? 'Z-Image 内置管线'}</span></div>
          <select id="zimage-provider" value={providerId} disabled={busy} onChange={(event) => switchProvider(event.target.value)}>
            {providerOptions.map((option) => <option key={option.id} value={option.id} disabled={!option.available}>{option.label}{option.available ? '' : ' · 需要模型'}</option>)}
          </select>
          {selectedResolution && !selectedResolution.available && <p className="field-help">缺少：{selectedResolution.missing.join('；')}</p>}
        </div>
        {providerId === 'zimage' && <fieldset className="zimage-mode-picker" disabled={busy}>
          <legend>生成模式</legend>
          <label className={variant === 'turbo' ? 'selected' : ''}><input type="radio" name="zimage-variant" checked={variant === 'turbo'} onChange={() => switchVariant('turbo')} /><Gauge size={18} /><span><strong>Z-Image Turbo</strong><small>Fast preview and everyday creation · 8 steps</small></span><em className={turboInstalled ? 'installed' : ''}>{turboInstalled ? 'Installed' : '需要模型'}</em></label>
          <label className={variant === 'base' ? 'selected' : ''}><input type="radio" name="zimage-variant" checked={variant === 'base'} onChange={() => switchVariant('base')} /><Sparkles size={18} /><span><strong>Original Z-Image</strong><small>Full-capacity detail and stronger prompt control · 40 steps</small></span><em className={baseInstalled ? 'installed' : ''}>{baseInstalled ? 'Installed' : '需要模型'}</em></label>
        </fieldset>}
        <div className="field-group">
          <div className="field-label"><label htmlFor="zimage-prompt">图像提示词</label><span>{prompt.length.toLocaleString()} characters</span></div>
          <SmartPromptEditor id="zimage-prompt" value={prompt} onChange={setPrompt} placeholder="Describe the subject, environment, composition, lens, lighting, color, and opening-frame details… Type // for production commands." disabled={busy} />
          <div className="zimage-prompt-actions"><button className="secondary-button" onClick={() => void enhance()} disabled={busy || assisting || !ollamaAvailable || !prompt.trim()} title={ollamaAvailable ? `Enhance with ${ollamaModel}` : `Configure ${llmProvider === 'lmstudio' ? 'LM Studio' : llmProvider === 'llama' ? 'llama.cpp' : 'Ollama'} in Settings`}>{assisting ? <LoaderCircle size={15} className="spin" /> : <WandSparkles size={15} />}Enhance with {llmProvider === 'lmstudio' ? 'LM Studio' : llmProvider === 'llama' ? 'llama.cpp' : 'Ollama'}</button><small>{ollamaAvailable ? `${ollamaModel} · local` : `${llmProvider === 'lmstudio' ? 'LM Studio' : llmProvider === 'llama' ? 'llama.cpp' : 'Ollama'} unavailable`}</small></div>
        </div>

        {(selectedProvider || variant === 'base') && <div className="field-group zimage-negative-prompt"><div className="field-label"><label htmlFor="zimage-negative-prompt">负面提示词 <small>质量预设</small></label><span>{negativePrompt.length.toLocaleString()} 字符</span></div><textarea id="zimage-negative-prompt" value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} placeholder="描述要抑制的瑕疵或不想要的元素…" disabled={busy} /><p className="field-help">Prefilled with a balanced artifact, anatomy, geometry, and unwanted-text filter. Edit or clear it when those elements are intentional.</p></div>}

        <RenderSize value={resolution} onChange={setResolution} provider="zimage" />
        <div className="field-group"><label className="video-checkbox"><input type="checkbox" checked={livePreview} onChange={(event) => setLivePreview(event.target.checked)} />Show live previews while generating</label><small className="field-help">Off skips the preview output for new renders. Progress and the saved image stay available.</small></div>
        <div className="zimage-seed-row"><label>Seed<input type="number" min="0" max="999999999999" value={seed} disabled={busy} onChange={(event) => setSeed(Number(event.target.value))} /></label><button className="secondary-button" disabled={busy} onClick={() => setSeed(Math.floor(Math.random() * 1_000_000_000))}><Dices size={15} />Randomize</button></div>

        <details className="zimage-model-settings">
          <summary>模型组件 <small>Advanced</small></summary>
          <div className="zimage-quality-controls"><label>采样步数<input type="number" min={stepBounds[0]} max={stepBounds[1]} value={steps} disabled={busy} onChange={(event) => { setSteps(Math.max(stepBounds[0], Math.min(stepBounds[1], Number(event.target.value)))) }} /></label><label>Guidance<input type="number" min={cfgBounds[0]} max={cfgBounds[1]} step="0.1" value={guidance} disabled={busy} onChange={(event) => { setGuidance(Math.max(cfgBounds[0], Math.min(cfgBounds[1], Number(event.target.value)))) }} /></label>{selectedProvider && <label>采样器<select value={sampler} disabled={busy} onChange={(event) => setSampler(event.target.value)}>{['euler', 'res_multistep', 'er_sde', 'unipc', 'dpmpp_2m'].map((name) => <option key={name}>{name}</option>)} </select></label>}{selectedProvider && <label>调度器<select value={scheduler} disabled={busy} onChange={(event) => setScheduler(event.target.value)}>{['simple', 'normal', 'karras'].map((name) => <option key={name}>{name}</option>)} </select></label>}</div>
          <p className="field-help">{selectedProvider ? selectedProvider.description + '（官方推荐参数已预填，可在高级选项中微调）。' : variant === 'turbo' ? 'Turbo 使用 8 步采样和 1 的引导系数。它针对速度进行了优化，不使用负面提示词。' : 'Original Z-Image is undistilled. The official range is 28–50 steps and guidance 3–5; 40 steps and guidance 4 balance detail and render time.'}</p>
          <div className="zimage-models">{componentFields.map((field) => <label key={field.key}>{field.label}<select value={field.value} disabled={busy} onChange={(event) => field.set(event.target.value)}>{!choices(info, field.node, field.field).includes(field.value) && <option value={field.value}>{field.value} · unavailable</option>}{choices(info, field.node, field.field).map((name) => <option key={name}>{name}</option>)}</select></label>)}</div>
          {!activeAvailable && <p className="field-help">{selectedResolution ? '缺少 ' + selectedResolution.missing.join('；') : 'Choose a matching ' + (variant === 'turbo' ? 'Z-Image Turbo' : '原始 Z-Image') + ' model registered with ComfyUI. The expected diffusion model is ' + (variant === 'turbo' ? 'z_image_turbo_bf16.safetensors' : 'z_image_bf16.safetensors') + '.'}</p>}
        </details>

        {message && <div className={`zimage-message ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{busy && <LoaderCircle size={16} className="spin" />}<span>{message}</span></div>}
        <div className="zimage-generate-bar">{busy && <button className="danger-button" onClick={() => void cancel()}><CircleStop size={16} />Cancel</button>}<button className="primary-button" disabled={busy || !connected || !activeAvailable || !prompt.trim()} onClick={() => void create()}>{busy ? <LoaderCircle size={18} className="spin" /> : <Sparkles size={18} />}{busy ? 'Creating image…' : '创建图像'}</button></div>
      </section>

      <PreviewPanel>
        <div className="panel-heading"><div><span>OUTPUT</span><strong>图像预览</strong></div>{result && <span className="zimage-complete"><Check size={13} />Ready</span>}</div>
        <div className="zimage-preview-stage">{result?.preview ? <img src={result.preview} alt="已生成的 Z-Image 输出" /> : visibleLivePreview ? <figure className="live-preview zimage-live-preview"><img src={visibleLivePreview.url} alt="Z-Image 实时采样预览" /><figcaption>实时采样预览{visibleLivePreview.step && visibleLivePreview.totalSteps ? ` · 第 ${visibleLivePreview.step}/${visibleLivePreview.totalSteps} 步` : ''}</figcaption></figure> : busy ? <div className="render-state"><ProductionLoading label={liveProgress?.label || '正在准备图像条件'}/><strong>正在创建您的图像</strong><span>{liveProgress?.label ?? `${resolution.replace('x', ' × ')} · ${livePreview ? '等待实时预览' : '正在渲染（无实时预览）'}`}</span></div> : <div className="empty-preview"><div className="preview-icon"><ImagePlus size={28} /></div><strong>你的图像将显示在这里</strong><span>描述静帧、选择画布，本地生成。</span></div>}</div>
        <div className="zimage-preview-actions"><span>{result ? `${result.name} · ${resolution.replace('x', ' × ')}` : 'Saved to ComfyUI · MiniMax_first_frames'}</span>{result && pinMap[result.name] ? <button type="button" className="secondary-button" title="解除固定后，重新生成将跟随当前全局图像模型" onClick={() => setPinMap(clearFilePin(result.name, localStorage))}><Pin size={13} />已固定：{catalog.find((provider) => provider.id === pinMap[result.name].providerId)?.label ?? pinMap[result.name].providerId} · 解除</button> : null}<div><button className="secondary-button" disabled={!result} onClick={() => result && onUse(result, resolution)}><ImagePlus size={16} />MiniMax I2V</button><button className="primary-button" disabled={!result} onClick={() => result && onUseLtx(result)} title="加载一个保持身份一致的 LTX 图生视频提示词"><Film size={16} />Send to LTX 2.5</button></div></div>
      </PreviewPanel>
    </div>
  </div>
}
