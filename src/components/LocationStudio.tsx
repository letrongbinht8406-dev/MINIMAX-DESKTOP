import { AssetLibraryRail } from './AssetLibraryRail'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Camera, Check, CircleStop, Film, ImagePlus, Images, LoaderCircle, MapPin, Orbit, Play, Sparkles, Trash2, TreePine, WandSparkles, X } from 'lucide-react'
import { choices, type ObjectInfo } from '../lib/comfyInfo'
import { buildZImage } from '../lib/zimage'
import { anyImageProviderAvailable, studioImagePrompt } from '../lib/imageProviders/studio'
import { pinnedStudioProvider, recordStudioPin } from '../lib/imageProviders/studioPin'
import { StudioPinBadge } from './StudioPinBadge'
import { resolveAttentionBackend } from '../lib/attentionBackend'
import { loadLocationProjects, locationReferences, newLocationProject, saveLocationProjects, LOCATION_LIBRARY_EVENT } from '../lib/locationLibrary'
import type { AppSettings, GenerationJob, LocationProject, MediaFile } from '../types'
import { ReferenceApprovalModal } from './ReferenceApprovalModal'
import { RenderConstruction } from './RenderConstruction'
import { ReliableVideo } from './ReliableVideo'
import { resolveLlmConnection } from '../lib/llmProvider'
import { analyzeReferenceImage } from '../lib/referenceAnalysis'

function cleanSinglePrompt(value: string) {
  return value.replace(/\\\s*(?:\r?\n|$)/g, ' ').replace(/[*_#`]+/g, '').replace(/\s+/g, ' ').trim()
}

const natureOnlyRule = 'Untouched natural landscape only. No buildings, houses, cabins, sheds, ruins, roads, streets, bridges, fences, signs, vehicles, power lines, utility poles, constructed paths, furniture, or other human-made structures and objects.'
const surveyCameras = [
  { id: 'wide-reveal', name: '广角揭示', note: 'Recommended · clearest geography', prompt: 'Use only wide and extra-wide shots with an 18–24mm lens. Begin from an elevated wide establishing position, then perform a slow forward crane and gentle three-quarter sweep that reveals foreground, middle ground, background, and the spatial relationship between major landmarks. Never use close-ups.' },
  { id: 'perimeter', name: '周边勘察', note: '围绕地点的广角环绕', prompt: 'Use only wide shots with a 20–24mm lens. Travel slowly around the outer perimeter in one continuous stabilized arc, keeping the whole environment readable while revealing each side and every major landmark. Never use close-ups.' },
  { id: 'forward-scout', name: '前方侦察', note: '穿越连通区域的广角路径', prompt: 'Use only wide shots with a 24mm lens. Glide slowly forward through the environment and use restrained left-right pans to expose connected zones, sightlines, terrain layers, and landmarks without cutting. Never use close-ups.' },
  { id: 'high-survey', name: '高空勘察', note: '广角下降总览', prompt: 'Use only wide aerial-style shots with a 20–24mm lens. Start high enough to read the complete geography, descend gradually, and finish in a broad eye-level establishing view while keeping all landmarks spatially consistent. Never use close-ups.' },
] as const

export function LocationStudio({ settings, info, connected, ollamaAvailable, automationJobs, onNotice, onCreateWalkthrough }: {
  settings: AppSettings
  info: ObjectInfo
  connected: boolean
  ollamaAvailable: boolean
  automationJobs?: GenerationJob[]
  onNotice(tone: 'error' | 'success' | 'neutral', text: string): void
  onCreateWalkthrough(project: LocationProject, options?: { duration: number; cameraLanguage: string }): Promise<string | null | void>
}) {
  const initial = useMemo(() => { const saved = loadLocationProjects(); return saved.length ? saved : [newLocationProject()] }, [])
  const [projects, setProjects] = useState(initial)
  const llm = resolveLlmConnection(settings)
  const [activeId, setActiveId] = useState(initial[0].id)
  const [job, setJob] = useState<{ id: string; url: string; locationId: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [splitting, setSplitting] = useState(false)
  const [assisting, setAssisting] = useState(false)
  const [guidedOpen, setGuidedOpen] = useState(false)
  const [guidedDuration, setGuidedDuration] = useState(10)
  const [guidedCamera, setGuidedCamera] = useState<(typeof surveyCameras)[number]['id']>('wide-reveal')
  const [guidedRunStartedAt, setGuidedRunStartedAt] = useState<number | null>(null)
  const [guidedPreviousSignature, setGuidedPreviousSignature] = useState('')
  const [videoDuration, setVideoDuration] = useState(0)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [candidate, setCandidate] = useState<{ locationId: string; file: MediaFile } | null>(null)
  const active = projects.find((project) => project.id === activeId) ?? projects[0]
  const activeAutomation = automationJobs?.find((job) => job.locationProjectId === active.id)
  const guidedAutomation = guidedRunStartedAt !== null && activeAutomation && activeAutomation.createdAt >= guidedRunStartedAt - 1000 ? activeAutomation : undefined
  const referenceSignature = active.referenceImages.map((file) => file.path).join('|')
  const guidedSetReady = Boolean(guidedAutomation?.status === 'completed' && active.referenceImages.length && referenceSignature !== guidedPreviousSignature)
  const commit = (next: LocationProject[]) => { setProjects(next); saveLocationProjects(next) }
  const patchById = (id: string, change: Partial<LocationProject>) => setProjects((current) => { const next = current.map((project) => project.id === id ? { ...project, ...change, updatedAt: Date.now() } : project); saveLocationProjects(next); return next })
  const patch = (change: Partial<LocationProject>) => patchById(active.id, change)
  useEffect(() => { const refresh = () => { const next = loadLocationProjects(); if (next.length) setProjects(next) }; window.addEventListener(LOCATION_LIBRARY_EVENT, refresh); return () => window.removeEventListener(LOCATION_LIBRARY_EVENT, refresh) }, [])

  const natureOnly = active.environmentMode === 'nature'
  const authoredPrompt = active.referencePrompt.trim() || [
    natureOnly ? `Cinematic natural-landscape reference image for ${active.name}.` : `Cinematic establishing reference image for ${active.name}.`, active.description,
    active.atmosphere && `Atmosphere: ${active.atmosphere}.`, active.timeOfDay && `Time of day and weather: ${active.timeOfDay}.`,
    active.continuityAnchors && `Continuity anchors: ${active.continuityAnchors}.`,
    active.locationContext !== 'mixed' && `This is an ${active.locationContext} location; preserve that context.`, active.accuracyDetails && `Must remain accurate: ${active.accuracyDetails}.`,
    natureOnly && natureOnlyRule,
    `${active.visualStyle}. Wide, clear view of the full location, stable ${natureOnly ? 'terrain, ecology, vegetation, water, rock formations,' : 'architectural and environmental details,'} coherent geography, no people as the focal subject, no text, no logos.`,
  ].filter(Boolean).join(' ')
  const prompt = natureOnly && !authoredPrompt.includes(natureOnlyRule) ? `${authoredPrompt} ${natureOnlyRule}` : authoredPrompt
  const enhance = async () => {
    if (!ollamaAvailable || assisting) return
    setAssisting(true)
    try {
      const modeInstruction = natureOnly
        ? `This location is NATURE ONLY. Enforce this exact rule in the result: ${natureOnlyRule}`
        : active.environmentMode === 'built'
          ? 'This is a built environment. Describe stable architecture, circulation, materials, entrances, structural landmarks, and spatial relationships.'
          : 'This environment may combine natural terrain and built elements, but only retain elements intentionally supplied by the user.'
      const result = await window.minimax.generateWithOllama(llm.url, llm.model, `Rewrite the location notes below as one concise, production-ready establishing-reference prompt. Preserve all intentional geography, layout, materials, ecology, lighting, weather, context, accuracy requirements, and continuity anchors. Make spatial relationships explicit and repeatable across future shots. ${modeInstruction} End with: wide clear establishing view, coherent geography, no people as the focal subject, no text, no logos. Return exactly one plain-text paragraph without Markdown, headings, field labels, bullets, or line breaks.\n\nName: ${active.name}\nEnvironment type: ${active.environmentMode}\nContext: ${active.locationContext}\nLayout or terrain: ${active.description}\nAtmosphere and lighting: ${active.atmosphere}\nTime and weather: ${active.timeOfDay}\nContinuity anchors: ${active.continuityAnchors}\nMust remain accurate: ${active.accuracyDetails}\nVisual style: ${active.visualStyle}`, llm.provider)
      patch({ referencePrompt: cleanSinglePrompt(result) })
      onNotice('success', natureOnly ? '纯自然地点提示词，已严格排除建筑结构。' : `Location continuity prompt refined locally with ${llm.label}.`)
    } catch (reason) { onNotice('error', reason instanceof Error ? reason.message : String(reason)) }
    finally { setAssisting(false) }
  }
  const zModel = choices(info, 'UNETLoader', 'unet_name').find((name) => /z[_-]?image.*turbo/i.test(name)) ?? 'z_image_turbo_bf16.safetensors'
  const zEncoder = choices(info, 'CLIPLoader', 'clip_name').find((name) => /qwen[_-]?3[_-]?4b/i.test(name)) ?? 'qwen_3_4b.safetensors'
  const zVae = choices(info, 'VAELoader', 'vae_name').find((name) => /^ae\.safetensors$/i.test(name)) ?? 'ae.safetensors'
  const zLegacyFiles = choices(info, 'UNETLoader', 'unet_name').includes(zModel) && choices(info, 'CLIPLoader', 'clip_name').includes(zEncoder) && choices(info, 'VAELoader', 'vae_name').includes(zVae)
  const zReady = connected && (zLegacyFiles || anyImageProviderAvailable(info, settings.customImageModels ?? []))
  const usedProviderRef = useRef<string | undefined>(undefined)
  const buildStill = (text: string, width: number, height: number, legacySteps: number): unknown => {
    // 逐文件 pin 优先于全局设置；pin 的 provider 不可用时自动降级（legacy/兜底）
    const explicit = pinnedStudioProvider('location', active.id, settings.customImageModels ?? []) ?? settings.imageProviderId
    if (explicit && explicit !== 'auto') {
      const picked = studioImagePrompt(info, explicit, { prompt: text, width, height }, settings.customImageModels ?? [])
      if (picked.ok) { usedProviderRef.current = picked.providerId; return picked.prompt }
    }
    usedProviderRef.current = undefined
    if (zLegacyFiles) return buildZImage(text, width, height, Math.floor(Math.random() * 1_000_000_000), zModel, zEncoder, zVae, legacySteps, 1, 'turbo', '', resolveAttentionBackend(settings.attentionBackend, choices(info, 'ModelAttentionBackend', 'attention')))
    const fallback = studioImagePrompt(info, null, { prompt: text, width, height }, settings.customImageModels ?? [])
    if (fallback.ok) { usedProviderRef.current = fallback.providerId; return fallback.prompt }
    throw new Error('No image model available: please install the Z-Image Turbo or Qwen-Image model set and rescan.')
  }
  const chooseImage = async (target: 'base' | 'reference' = 'reference') => {
    const picked = await window.minimax.chooseMedia('image'); if (!picked) return
    const projectId = active.id
    const file: MediaFile = { ...picked, kind: 'image', preview: await window.minimax.mediaUrl(picked.path) }
    patch(target === 'base' ? { baseImage: file } : { referenceImages: [...active.referenceImages, file], selectedReferencePaths: active.selectedReferencePaths === undefined ? undefined : [...active.selectedReferencePaths, file.path] })
    if (!ollamaAvailable) { onNotice('neutral', '图片已添加。连接本地视觉模型以自动填充地点资料。'); return }
    onNotice('neutral', 'Image added. The local vision model is filling empty location fields…')
    try {
      const result = await analyzeReferenceImage(settings, picked.path, 'location')
      const current = loadLocationProjects().find((item) => item.id === projectId)
      if (!current) return
      const environmentMode = current.environmentMode !== 'mixed' ? current.environmentMode : ['mixed', 'nature', 'built'].includes(result.environmentMode) ? result.environmentMode as LocationProject['environmentMode'] : current.environmentMode
      patchById(projectId, { name: !current.name.trim() || /^Location \d+$/i.test(current.name) ? result.name || current.name : current.name, environmentMode, description: current.description.trim() ? current.description : result.description, atmosphere: current.atmosphere.trim() ? current.atmosphere : result.atmosphere, timeOfDay: current.timeOfDay.trim() ? current.timeOfDay : result.timeOfDay, continuityAnchors: current.continuityAnchors.trim() ? current.continuityAnchors : result.continuityAnchors, visualStyle: current.visualStyle.trim() && current.visualStyle !== '电影级写实' ? current.visualStyle : result.visualStyle || current.visualStyle })
      onNotice('success', 'Existing image analyzed; empty location fields were filled for review.')
    } catch (reason) { onNotice('error', `The image was added, but automatic description failed: ${reason instanceof Error ? reason.message : String(reason)}`) }
  }
  const chooseWalkthrough = async () => { const picked = await window.minimax.chooseMedia('video'); if (!picked) return; patch({ walkthroughVideo: { ...picked, kind: 'video', preview: await window.minimax.mediaUrl(picked.path) } }); setVideoDuration(0) }
  const createMaster = async () => {
    if (!zReady || busy || !prompt.trim()) return
    setBusy(true); setError(false); setMessage('Submitting the location reference to Z-Image Turbo…')
    try { const response = await window.minimax.submitPrompt(settings.comfyUrl, buildStill(prompt, 1344, 768, 8)); setJob({ id: response.prompt_id, url: settings.comfyUrl, locationId: active.id }); setMessage('Constructing the location reference in ComfyUI…') }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); setError(true); setBusy(false) }
  }
  const cancel = async () => { if (!job) return; try { await window.minimax.cancelPrompt(job.url, job.id); setMessage('地点参考渲染已取消。') } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); setError(true) } finally { setJob(null); setBusy(false) } }
  useEffect(() => {
    if (!job) return
    let disposed = false; let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const history = await window.minimax.getHistory(job.url, job.id)
        const entry = history[job.id] as { status?: { status_str?: string }; outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }> } | undefined
        if (entry?.status?.status_str === 'error') throw new Error('地点参考生成失败。请检查 ComfyUI 日志。')
        const image = Object.values(entry?.outputs ?? {}).flatMap((output) => output.images ?? [])[0]
        if (image) { const preview = await window.minimax.getOutputImage(job.url, image); const saved = await window.minimax.saveComfyOutputImage(job.url, image, settings.outputDirectory); recordStudioPin('location', job.locationId, usedProviderRef.current, '1344x768', settings.customImageModels ?? []); if (!disposed) { setCandidate({ locationId: job.locationId, file: { ...saved, preview, kind: 'image' } }); setBusy(false); setJob(null); setError(false); setMessage('地点参考已就绪，等待确认。') }; return }
      } catch (reason) { if (!disposed) { setMessage(reason instanceof Error ? reason.message : String(reason)); setError(true); setBusy(false); setJob(null) }; return }
      if (!disposed) timer = setTimeout(poll, 2000)
    }
    void poll(); return () => { disposed = true; clearTimeout(timer) }
  }, [job, onNotice, settings.outputDirectory, settings.customImageModels])
  const extractWalkthrough = async () => {
    if (!active.walkthroughVideo || !videoDuration || splitting) return
    setSplitting(true)
    try {
      const positions = [0.05, .25, .5, .75, .95].map((ratio) => Math.max(0, Math.min(videoDuration - .04, videoDuration * ratio)))
      const files = await Promise.all(positions.map(async (position) => { const result = await window.minimax.extractVideoFrame(active.walkthroughVideo!.path, position, settings.outputDirectory, settings.ffmpegPath); return { ...result, kind: 'image' as const, preview: await window.minimax.mediaUrl(result.path) } }))
      patch({ referenceImages: files, referenceMode: 'set', selectedReferencePaths: undefined }); onNotice('success', '已从此地点参考集中提取五帧行走画面。')
    } catch (reason) { onNotice('error', reason instanceof Error ? reason.message : String(reason)) } finally { setSplitting(false) }
  }
  const add = () => { const project = newLocationProject(projects.length + 1); commit([...projects, project]); setActiveId(project.id) }
  const remove = () => { if (!window.confirm(`Delete location “${active.name}”? Original media remains on disk.`)) return; const next = projects.filter((project) => project.id !== active.id); const fallback = next.length ? next : [newLocationProject()]; commit(fallback); setActiveId(fallback[0].id) }
  const selected = locationReferences(active)
  const startGuidedSurvey = async () => {
    if (!active.baseImage) return
    setGuidedPreviousSignature(referenceSignature)
    setGuidedRunStartedAt(Date.now())
    const cameraLanguage = surveyCameras.find((camera) => camera.id === guidedCamera)?.prompt ?? surveyCameras[0].prompt
    const failure = await onCreateWalkthrough(active, { duration: guidedDuration, cameraLanguage })
    if (failure) { setGuidedRunStartedAt(null); setError(true); setMessage(failure) }
  }
  const approveCandidate = () => {
    if (!candidate) return
    const project = loadLocationProjects().find((item) => item.id === candidate.locationId)
    if (!project) { setCandidate(null); return }
    patchById(project.id, { baseImage: candidate.file })
    setCandidate(null); setMessage('Master approved. Preparing the walkthrough…')
    if (guidedOpen) {
      setGuidedPreviousSignature(referenceSignature)
      setGuidedRunStartedAt(Date.now())
      const cameraLanguage = surveyCameras.find((camera) => camera.id === guidedCamera)?.prompt ?? surveyCameras[0].prompt
      void onCreateWalkthrough({ ...project, baseImage: candidate.file }, { duration: guidedDuration, cameraLanguage }).then((failure) => { if (failure) { setGuidedRunStartedAt(null); setError(true); setMessage(failure) } })
    } else void onCreateWalkthrough({ ...project, baseImage: candidate.file }).then((failure) => { if (failure) { setError(true); setMessage(failure) } })
  }
  return <><div className="standard-page character-studio location-studio">
    <div className="page-heading"><div><p className="eyebrow">GLOBAL LOCATION LIBRARY</p><h1>Location Studio</h1><p>Build reusable natural landscapes, constructed places, walkthroughs, and continuity-ready views.</p></div><div className="heading-state"><span className={active.baseImage ? 'ok' : 'warn'}>{active.baseImage ? <Check size={15} /> : natureOnly ? <TreePine size={15} /> : <MapPin size={15} />}{active.baseImage ? '主参考已就绪' : natureOnly ? '纯自然模式已启用' : '创建地点参考'}</span></div></div>
    <div className="character-studio-grid"><AssetLibraryRail title="Locations" items={projects.map(project => ({ id: project.id, name: project.name, detail: `${project.environmentMode === 'nature' ? '纯自然' : project.environmentMode === 'built' ? '人造环境' : '混合环境'} · ${locationReferences(project).length} reference${locationReferences(project).length === 1 ? '' : 's'}`, preview: project.baseImage?.preview, placeholder: project.environmentMode === 'nature' ? <TreePine size={18} /> : project.environmentMode === 'built' ? <Building2 size={18} /> : <MapPin size={18} /> }))} activeId={active.id} onAdd={add} onSelect={id => { setActiveId(id); setVideoDuration(0) }} />
      <section className="character-workbench"><header><div><MapPin size={18} /><span><strong>地点与连续性</strong><small>Stable world details that can be reused across shots and movies.</small></span></div><StudioPinBadge studio="location" assetId={active.id} customModels={settings.customImageModels ?? []} /><button className="danger-button" onClick={remove}><Trash2 size={14} />删除地点</button></header>
        <div className="character-setup-grid"><section className="character-setup-panel"><div className="character-section-heading"><span>{natureOnly ? <TreePine size={15} /> : <MapPin size={15} />}</span><div><strong>场景配置</strong><small>在描述固定地理特征之前，请先定义环境类型。</small></div><em>{active.name.trim() ? '已保存到本地' : '名称为必填项'}</em></div>
          <label className={`location-nature-toggle ${natureOnly ? 'selected' : ''}`}>
            <input type="checkbox" checked={natureOnly} onChange={(event) => patch({ environmentMode: event.target.checked ? 'nature' : 'mixed', referencePrompt: '' })} />
            <TreePine size={16} />
            <span><strong>仅限自然</strong><small>Exclude buildings, roads, utilities, vehicles, and every other human-made object.</small></span>
          </label>
          {natureOnly && <div className="location-nature-rule"><TreePine size={15} /><span><strong>已强制执行结构排除</strong><small>Master images, refined prompts, and walkthroughs all block buildings and other human-made elements.</small></span></div>}
          <div className="character-form"><label>场景名称<input value={active.name} onChange={(event) => patch({ name: event.target.value, referencePrompt: '' })} /></label><label>视觉风格<input value={active.visualStyle} onChange={(event) => patch({ visualStyle: event.target.value, referencePrompt: '' })} placeholder="电影级写实" /></label><label>场景上下文<select value={active.locationContext} onChange={(event) => patch({ locationContext: event.target.value as LocationProject['locationContext'], referencePrompt: '' })}><option value="interior">Interior</option><option value="exterior">Exterior</option><option value="mixed">Indoor + outdoor</option></select><small>Sets whether interiors, exteriors, or their connection is authoritative.</small></label><label className="wide">{natureOnly ? '地形、生态与地理' : active.environmentMode === 'built' ? '建筑与空间布局' : '环境与空间布局'}<textarea value={active.description} onChange={(event) => patch({ description: event.target.value, referencePrompt: '' })} placeholder={natureOnly ? 'Landforms, vegetation zones, water, rock formations, trails made by wildlife…' : 'Materials, landmarks, rooms, circulation, terrain, streets…'} /></label><label>氛围与光照<textarea value={active.atmosphere} onChange={(event) => patch({ atmosphere: event.target.value, referencePrompt: '' })} placeholder="Mood, light direction, palette, haze, precipitation…" /></label><label>Time and weather<textarea value={active.timeOfDay} onChange={(event) => patch({ timeOfDay: event.target.value, referencePrompt: '' })} placeholder="Season, time of day, cloud cover, wind, ground conditions…" /></label><label className="wide">连续性锚点<textarea value={active.continuityAnchors} onChange={(event) => patch({ continuityAnchors: event.target.value, referencePrompt: '' })} placeholder={natureOnly ? 'Distinct tree line, waterfall position, ridge silhouette, river bend, rock cluster…' : 'Fixed entrances, landmarks, object positions, sightlines, persistent damage or signage…'} /></label><label className="wide"><strong>Must-match location details</strong><small>Facts that must stay accurate in every render: interior layout, room connections, exterior façade, signs, furniture, windows, damage, landmarks, object positions, or protected details.</small><textarea value={active.accuracyDetails} onChange={(event) => patch({ accuracyDetails: event.target.value, referencePrompt: '' })} placeholder="Example: Interior is a green tiled diner; preserve the U-shaped counter, six red stools, west-facing windows, neon pie sign, and the exact doorway into the kitchen." /></label></div>
          <div className="character-assist"><span><Sparkles size={16} /><span><strong>{llm.label} continuity assistant</strong><small>{natureOnly ? '在严格保持仅限自然排除规则的同时，优化景观描述。' : '将粗略笔记转化为可复用的空间锚点。'}</small></span></span><button className="secondary-button" disabled={!ollamaAvailable || assisting} onClick={() => void enhance()}>{assisting ? <LoaderCircle className="spin" size={14} /> : <WandSparkles size={14} />}Refine location</button></div></section>
          <section className="character-setup-panel character-prompt-panel"><div className="character-section-heading"><span><Sparkles size={15} /></span><div><strong>主提示词</strong><small>The exact Z-Image prompt for this location.</small></div><em>{prompt.length.toLocaleString()} characters</em></div><label className="character-reference-prompt"><span><strong>可编辑渲染提示词</strong><small>{natureOnly ? '编辑此提示词时，仅限自然的结构排除规则仍然生效。' : '更改将应用于下一个主参考。'}</small></span><textarea aria-label="场景主提示词" value={prompt} onChange={(event) => patch({ referencePrompt: event.target.value })} /></label></section></div>
        <section className="location-guided-option"><div className="location-guided-icon"><Orbit size={20} /></div><div><span className="recommended-badge">Recommended</span><strong>Create a location set with LTX 2.5</strong><small>Build one crisp wide-shot survey, automatically extract five balanced views, review them, and move the approved set into this location.</small></div><button className="primary-button" onClick={() => { setGuidedRunStartedAt(null); setGuidedPreviousSignature(referenceSignature); setGuidedOpen(true) }}><Sparkles size={14} />Open guided builder</button></section>
        <div className="character-production-heading"><span>参考制作</span><small>Build the place, survey it, then approve the useful views.</small><em>{Number(Boolean(active.baseImage)) + Number(Boolean(active.walkthroughVideo)) + Number(selected.length > 0)} of 3 ready</em></div>
        <div className="character-production-grid"><article className="character-master-card"><header><span><strong>1. Master reference</strong><small>Generate a clear establishing view.</small></span><span className={`master-engine-state ${zReady ? 'ready' : ''}`}>{zReady ? <Check size={12} /> : <MapPin size={12} />}{zReady ? 'Z-Image 已就绪' : 'Z-Image 不可用'}</span></header><div className="character-media-stage">{active.baseImage?.preview ? <img src={active.baseImage.preview} alt={`${active.name} master reference`} /> : busy ? <div><LoaderCircle className="spin" size={26} /><span>Creating master reference…</span></div> : <div><ImagePlus size={26} /><span>No master image</span></div>}</div>{message && <div className={`character-master-message ${error ? 'error' : ''}`}>{busy && <LoaderCircle className="spin" size={13} />}<span>{message}</span></div>}<footer><button className="secondary-button" disabled={busy} onClick={() => void chooseImage('base')}><ImagePlus size={14} />选择已有</button>{busy && <button className="danger-button" onClick={() => void cancel()}><CircleStop size={14} />Cancel</button>}<button className="primary-button" disabled={busy || !zReady || !active.name.trim()} onClick={() => void createMaster()}><Sparkles size={14} />{busy ? 'Creating…' : active.baseImage ? '重新生成主图' : '创建主图'}</button></footer></article>
          <article><header><span><strong>2. {natureOnly ? '景观勘察' : '漫游视频'}</strong><small>{natureOnly ? 'Survey terrain, vegetation, water, formations, and spatial geography.' : 'Survey every zone, landmark, and spatial connection.'}</small></span>{activeAutomation && <span className={`status-badge ${activeAutomation.status}`}>{activeAutomation.status}</span>}</header><div className="character-media-stage">{active.walkthroughVideo?.preview ? <ReliableVideo src={active.walkthroughVideo.preview} controls preload="metadata" onLoadedMetadata={(event) => setVideoDuration(event.currentTarget.duration)} /> : activeAutomation && ['queued', 'running'].includes(activeAutomation.status) ? <div className="location-survey-progress"><RenderConstruction /><strong>{activeAutomation.progressLabel ?? '正在渲染 LTX 2.5 勘察'}</strong><span>{activeAutomation.currentStep !== undefined && activeAutomation.totalSteps ? `Sampler step ${activeAutomation.currentStep} of ${activeAutomation.totalSteps}` : '正在构建广角场景勘察'}</span><div className="progress"><i style={{ width: `${activeAutomation.progress}%` }} /></div><small>{Math.round(activeAutomation.progress)}% · live ComfyUI progress</small></div> : <div><Orbit size={26} /><span>No {natureOnly ? '景观勘察' : '漫游视频'}</span></div>}</div><footer><button className="secondary-button" onClick={() => void chooseWalkthrough()}><Film size={14} />选择已渲染视频</button><button className="primary-button" disabled={!active.baseImage || Boolean(activeAutomation && ['queued', 'running'].includes(activeAutomation.status))} onClick={() => void onCreateWalkthrough(active)}><Orbit size={14} />{activeAutomation && ['queued', 'running'].includes(activeAutomation.status) ? 'Rendering…' : natureOnly ? '渲染景观勘察' : '渲染完整漫游'}</button></footer></article></div>
        <section className="character-reference-set"><header><span><strong>3. Approved location references</strong><small>Selected views are available for reference renders and future movies.</small></span><button className="secondary-button" disabled={!active.walkthroughVideo || !videoDuration || splitting} onClick={() => void extractWalkthrough()}>{splitting ? <LoaderCircle className="spin" size={14} /> : <Images size={14} />}{splitting ? 'Extracting…' : '提取 5 个视角'}</button></header><fieldset><legend>Use in renders</legend><label><input type="radio" name="location-reference-mode" checked={active.referenceMode === 'single'} onChange={() => patch({ referenceMode: 'single' })} />单张主图</label><label><input type="radio" name="location-reference-mode" checked={active.referenceMode === 'set'} onChange={() => patch({ referenceMode: 'set' })} />已选参考视角</label></fieldset><div className="character-reference-grid">{active.referenceImages.map((file, index) => { const checked = active.selectedReferencePaths === undefined || active.selectedReferencePaths.includes(file.path); return <figure className={checked ? 'selected' : ''} key={`${file.path}-${index}`}><img src={file.preview} alt={`${active.name} reference ${index + 1}`} /><figcaption><label><input type="checkbox" checked={checked} onChange={(event) => { const current = active.selectedReferencePaths ?? active.referenceImages.map((item) => item.path); patch({ referenceMode: 'set', selectedReferencePaths: event.target.checked ? [...new Set([...current, file.path])] : current.filter((path) => path !== file.path) }) }} />Use view {index + 1}</label></figcaption><button aria-label={`Remove reference view ${index + 1}`} onClick={() => patch({ referenceImages: active.referenceImages.filter((_, itemIndex) => itemIndex !== index), selectedReferencePaths: active.selectedReferencePaths?.filter((path) => path !== file.path) })}><X size={13} /></button></figure> })}<button className="character-add-reference" onClick={() => void chooseImage()}><ImagePlus size={19} /><span>Add reference</span></button></div></section>
      </section></div>
  </div>{guidedOpen && <div className="location-builder-backdrop"><section className="location-builder-modal" role="dialog" aria-modal="true" aria-labelledby="location-builder-title" onKeyDown={(event) => { if (event.key === 'Escape') setGuidedOpen(false) }}><header><span><Orbit size={19} /><span><strong id="location-builder-title">LTX 2.5 location-set builder</strong><small>Wide-shot survey → five extracted images → approved location references</small></span></span><button className="icon-button" aria-label="关闭场景构建器" onClick={() => setGuidedOpen(false)}><X size={18} /></button></header><div className="location-builder-body">
    <ol className="location-builder-steps"><li className={active.baseImage ? 'complete' : 'active'}><span>1</span><div><strong>起始图</strong><small>{active.baseImage ? 'Ready' : '创建或选择一个'}</small></div></li><li className={guidedAutomation && ['queued', 'running', 'completed'].includes(guidedAutomation.status) ? guidedAutomation.status === 'completed' ? 'complete' : 'active' : ''}><span>2</span><div><strong>LTX wide survey</strong><small>{guidedAutomation && ['queued', 'running'].includes(guidedAutomation.status) ? `${Math.round(guidedAutomation.progress)}%` : guidedAutomation?.status === 'completed' ? 'Rendered' : `${guidedDuration} seconds`}</small></div></li><li className={guidedSetReady ? 'complete' : ''}><span>3</span><div><strong>Five images</strong><small>{guidedSetReady ? '已添加到场景' : '自动提取'}</small></div></li></ol>
    {candidate ? <section className="location-builder-stage"><div className="location-builder-stage-heading"><span><strong>确认起始图</strong><small>Check the complete geography before LTX creates the wide survey.</small></span></div><img className="location-builder-master" src={candidate.file.preview} alt="已生成的场景起始图" /><div className="location-builder-actions"><button className="secondary-button" onClick={() => { setCandidate(null); void createMaster() }}>Try another</button><button className="primary-button" onClick={approveCandidate}><Check size={14} />批准并继续</button></div></section>
    : !active.baseImage ? <section className="location-builder-stage location-builder-empty"><ImagePlus size={30} /><strong>从一张清晰的广角图像开始</strong><p>LTX 2.5 uses this image as the visual anchor for the complete survey. The generated clip and extracted frames stay attached to {active.name}.</p>{message && <div className={`character-master-message ${error ? 'error' : ''}`}>{busy && <LoaderCircle className="spin" size={13} />}<span>{message}</span></div>}<div className="location-builder-actions"><button className="secondary-button" disabled={busy} onClick={() => void chooseImage('base')}><ImagePlus size={14} />选择现有图像</button>{busy && <button className="danger-button" onClick={() => void cancel()}><CircleStop size={14} />Cancel</button>}<button className="primary-button" disabled={busy || !zReady || !active.name.trim()} onClick={() => void createMaster()}>{busy ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}{busy ? 'Creating…' : '创建起始图像'}</button></div>{!zReady && <small className="location-builder-note">Z-Image is unavailable. Choose an existing wide image, or start ComfyUI with the required Z-Image models.</small>}</section>
    : !guidedRunStartedAt ? <section className="location-builder-stage"><div className="location-builder-config"><figure><img src={active.baseImage.preview} alt={`${active.name} starting image`} /><figcaption>起始图 · {active.name}</figcaption></figure><div><fieldset><legend>Wide-shot camera language</legend>{surveyCameras.map((camera) => <label className={guidedCamera === camera.id ? 'selected' : ''} key={camera.id}><input type="radio" name="location-survey-camera" checked={guidedCamera === camera.id} onChange={() => setGuidedCamera(camera.id)} /><Camera size={15} /><span><strong>{camera.name}</strong><small>{camera.note}</small></span></label>)}</fieldset><label className="location-builder-duration"><span><strong>Clip duration</strong><small>更长的片段能展现更多地理信息，但需要更多时间。</small></span><input type="range" min="5" max="20" step="1" value={guidedDuration} onChange={(event) => setGuidedDuration(Number(event.target.value))} /><output>{guidedDuration}s</output></label><div className="location-builder-clarity"><Check size={14} /><span><strong>Crisp-frame protection</strong><small>Fast shutter, stabilized motion, no motion blur, smearing, ghosting, whip pans, or rolling-shutter distortion.</small></span></div></div></div><div className="location-builder-actions"><button className="secondary-button" onClick={() => void chooseImage('base')}><ImagePlus size={14} />替换起始图像</button><button className="primary-button" disabled={!connected} onClick={startGuidedSurvey}><Play size={14} fill="currentColor" />Create wide survey with LTX 2.5</button></div></section>
    : !guidedAutomation ? <section className="location-builder-stage location-builder-progress"><LoaderCircle className="spin" size={30} /><strong>Submitting the LTX 2.5 survey…</strong><p>The guided builder will remain linked to this location if you close it.</p></section>
    : guidedAutomation.status === 'failed' || guidedAutomation.status === 'cancelled' ? <section className="location-builder-stage location-builder-empty"><CircleStop size={30} /><strong>{guidedAutomation.status === 'failed' ? 'LTX 勘察失败' : 'LTX 勘察已取消'}</strong><p>{guidedAutomation.error ?? '没有位置图像被修改。'}</p><div className="location-builder-actions"><button className="primary-button" onClick={() => setGuidedRunStartedAt(null)}>检查并重试</button></div></section>
    : guidedAutomation.status !== 'completed' ? <section className="location-builder-stage location-builder-progress"><RenderConstruction /><strong>{guidedAutomation.progressLabel ?? '正在渲染广角位置勘察'}</strong><p>{guidedDuration}s · {surveyCameras.find((camera) => camera.id === guidedCamera)?.name} · crisp frames</p><div className="progress"><i style={{ width: `${guidedAutomation.progress}%` }} /></div><small>{Math.round(guidedAutomation.progress)}% · the five reference images will be extracted automatically</small></section>
    : !guidedSetReady ? <section className="location-builder-stage location-builder-empty"><Images size={30} /><strong>The survey rendered, but the image set was not imported</strong><p>Use the existing extraction control after closing this builder, or retry the survey. The rendered video remains attached to this location.</p><div className="location-builder-actions"><button className="secondary-button" onClick={() => setGuidedOpen(false)}>关闭并手动提取</button><button className="primary-button" onClick={() => setGuidedRunStartedAt(null)}>检查并重试</button></div></section>
    : <section className="location-builder-stage"><div className="location-builder-stage-heading"><span><strong>位置图像集已就绪</strong><small>These images have been moved into Approved location references. Uncheck any view you do not want used in renders.</small></span><span className="recommended-badge">{locationReferences(active).length} selected</span></div><div className="location-builder-results">{active.referenceImages.map((file, index) => { const checked = active.selectedReferencePaths === undefined || active.selectedReferencePaths.includes(file.path); return <label className={checked ? 'selected' : ''} key={`${file.path}-${index}`}><img src={file.preview} alt={`${active.name} extracted wide view ${index + 1}`} /><span><input type="checkbox" checked={checked} onChange={(event) => { const current = active.selectedReferencePaths ?? active.referenceImages.map((item) => item.path); patch({ referenceMode: 'set', selectedReferencePaths: event.target.checked ? [...new Set([...current, file.path])] : current.filter((path) => path !== file.path) }) }} />Wide view {index + 1}</span></label> })}</div><div className="location-builder-actions"><button className="primary-button" disabled={!locationReferences(active).length} onClick={() => { patch({ referenceMode: 'set' }); setGuidedOpen(false); onNotice('success', `${locationReferences(active).length} LTX location views are ready to use.`) }}><Check size={14} />完成位置集</button></div></section>}
  </div><footer><span><strong>{natureOnly ? '仅自然规则已启用' : '连续性已保护'}</strong><small>All camera presets use wide shots and explicit no-motion-blur instructions.</small></span>{guidedAutomation && ['queued', 'running'].includes(guidedAutomation.status) && <button className="secondary-button" onClick={() => setGuidedOpen(false)}>Close · keep rendering</button>}</footer></section></div>}{candidate && !guidedOpen && <ReferenceApprovalModal title="批准位置主图" description={natureOnly ? '检查地形、生态、光照和反复出现的标志物，并确认没有出现人造建筑。' : '继续之前，请检查地理、建筑、光照和反复出现的标志物。'} image={candidate.file.preview ?? ''} approveLabel={natureOnly ? '批准并勘察景观' : '批准并制作漫游'} nextStep={natureOnly ? '批准后保存此主文件，排队执行纯自然景观勘察，然后将视频和五个地形视图导入此处。' : 'Approval saves this master, queues the walkthrough in the background, then imports the video and five location views here.'} approveStartsGeneration onClose={() => setCandidate(null)} onRetry={() => { setCandidate(null); void createMaster() }} onApprove={approveCandidate} />}</>
}
