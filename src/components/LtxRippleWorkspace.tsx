import { useEffect, useState } from 'react'
import { ArrowRight, Film, ImagePlus, LoaderCircle, RotateCcw, Sparkles, Upload, Video } from 'lucide-react'
import type { AppSettings, GenerationJob, MediaFile } from '../types'
import { LTX_RIPPLE_DEFAULT_PROMPT, LTX_RIPPLE_PRESET_SECONDS, rippleFrameOptions, rippleFramesForSeconds, type LtxRippleOptions } from '../lib/ltxRippleWorkflow'
import { defaultFrameResolution, isValidFrameSize, resolveFrameSize, type FrameResolution, type FrameSize } from '../lib/frameResolution'
import type { LivePreview } from '../lib/useLivePreview'
import { FrameResolutionControl } from './FrameResolutionControl'
import { planRippleChunks } from '../lib/ltxRippleBatch'
import { ReliableVideo } from './ReliableVideo'
import { VideoExportButtons } from './VideoExportButtons'
import './ltx-ripple.css'

type RippleDraft = { source: MediaFile | null; editedFrame: MediaFile | null; frames: number; lengthMode: 'preset' | 'custom'; customSeconds: number; longMode: boolean; chunkSeconds: number; overlapSeconds: number; blendTransitions: boolean; prompt: string; negativePrompt: string; strength: number; guideStrength: number; seed: number; resolution: FrameResolution; livePreview: boolean; previewMode: 'standard' | 'sampling-override' }
const storageKey = 'ltx-ripple.workspace.v1'
const initialDraft: RippleDraft = { source: null, editedFrame: null, frames: 97, lengthMode: 'custom', customSeconds: 4, longMode: false, chunkSeconds: 10, overlapSeconds: 1, blendTransitions: true, prompt: LTX_RIPPLE_DEFAULT_PROMPT, negativePrompt: '', strength: 1.35, guideStrength: 1, seed: Math.floor(Math.random() * 1_000_000_000), resolution: defaultFrameResolution, livePreview: true, previewMode: 'standard' }

function readDraft(): RippleDraft {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<RippleDraft>
    return { ...initialDraft, ...stored, guideStrength: typeof stored.guideStrength === 'number' && stored.guideStrength >= 0.5 && stored.guideStrength <= 1 ? stored.guideStrength : 1, resolution: stored.resolution?.mode ? stored.resolution : defaultFrameResolution, source: stored.source?.path ? stored.source : null, editedFrame: stored.editedFrame?.path ? stored.editedFrame : null }
  } catch { return initialDraft }
}

export function LtxRippleWorkspace({ settings, outputDirectory, connected, liveConnected, livePreview, samplingPreviewNodeType, batchPromptId, missingNodes, lora, modelReady, latestJob, submitting, incomingReplacement, onConsumeReplacement, onEditFirstFrame, onGenerate, onGenerateLong, onCancel }: {
  settings: AppSettings
  outputDirectory: string
  connected: boolean
  liveConnected: boolean
  livePreview: LivePreview | null
  samplingPreviewNodeType: string | null
  batchPromptId: string | null
  missingNodes: string[]
  lora: string
  modelReady: boolean
  latestJob?: GenerationJob
  submitting: boolean
  incomingReplacement: { file: MediaFile; size: FrameSize } | null
  onConsumeReplacement(): void
  onEditFirstFrame(file: MediaFile, size: FrameSize): void
  onGenerate(options: LtxRippleOptions, source: MediaFile, editedFrame: MediaFile): Promise<string | null>
  onGenerateLong(options: LtxRippleOptions, source: MediaFile, editedFrame: MediaFile, chunkSeconds: number, overlapSeconds: number, blend: boolean): Promise<string | null>
  onCancel(job: GenerationJob): void
}) {
  const [draft, setDraft] = useState<RippleDraft>(() => {
    const stored = readDraft()
    if (!incomingReplacement) return stored
    const aligned = isValidFrameSize(incomingReplacement.size) ? incomingReplacement.size : resolveFrameSize(incomingReplacement.size, { ...defaultFrameResolution, mode: 'source' })
    return { ...stored, editedFrame: incomingReplacement.file, resolution: aligned ? { mode: 'custom', ...aligned } : defaultFrameResolution }
  })
  const [sourceUrl, setSourceUrl] = useState('')
  const [editedUrl, setEditedUrl] = useState('')
  const [editedSize, setEditedSize] = useState<FrameSize | null>(null)
  const [sourceFirstUrl, setSourceFirstUrl] = useState('')
  const [sourceFirstFrame, setSourceFirstFrame] = useState<MediaFile | null>(null)
  const [metadata, setMetadata] = useState<{ duration: number; frameCount: number; width: number; height: number } | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const patch = (values: Partial<RippleDraft>) => setDraft(current => ({ ...current, ...values }))
  useEffect(() => {
    if (!incomingReplacement) return
    const aligned = isValidFrameSize(incomingReplacement.size) ? incomingReplacement.size : resolveFrameSize(incomingReplacement.size, { ...defaultFrameResolution, mode: 'source' })
    setDraft(current => ({ ...current, editedFrame: incomingReplacement.file, resolution: aligned ? { mode: 'custom', ...aligned } : defaultFrameResolution }))
    onConsumeReplacement()
  }, [incomingReplacement, onConsumeReplacement])
  useEffect(() => {
    const saved = { ...draft, source: draft.source ? { ...draft.source, preview: undefined } : null, editedFrame: draft.editedFrame ? { ...draft.editedFrame, preview: undefined } : null }
    localStorage.setItem(storageKey, JSON.stringify(saved))
  }, [draft])
  useEffect(() => {
    let active = true
    setMetadata(null); setSourceUrl(''); setSourceFirstUrl(''); setSourceFirstFrame(null)
    if (!draft.source) return
    setBusy('正在读取源片段')
    Promise.all([
      window.minimax.mediaUrl(draft.source.path),
      window.minimax.getVideoMetadata(draft.source.path, settings.ffmpegPath),
      window.minimax.extractVideoFrame(draft.source.path, 0, outputDirectory, settings.ffmpegPath),
    ]).then(async ([url, meta, frame]) => {
      const firstUrl = await window.minimax.mediaUrl(frame.path)
      if (!active) return
      setSourceUrl(url); setSourceFirstUrl(firstUrl); setSourceFirstFrame({ path: frame.path, name: frame.name, kind: 'image' }); setMetadata(meta); setBusy('')
    }).catch(reason => { if (active) { setBusy(''); setError(`Source could not be read. ${reason instanceof Error ? reason.message : String(reason)}`) } })
    return () => { active = false }
  }, [draft.source, settings.ffmpegPath, outputDirectory])
  useEffect(() => {
    let active = true
    setEditedUrl(''); setEditedSize(null)
    if (draft.editedFrame) window.minimax.mediaUrl(draft.editedFrame.path).then(url => { if (active) setEditedUrl(url) }).catch(reason => { if (active) setError(`Edited frame could not be read. ${String(reason)}`) })
    return () => { active = false }
  }, [draft.editedFrame])
  const choose = async (kind: 'video' | 'image') => {
    try {
      const selected = await window.minimax.chooseMedia(kind)
      if (!selected) return
      setError('')
      if (kind === 'video') patch({ source: { ...selected, kind } })
      else patch({ editedFrame: { ...selected, kind } })
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }
  const frameOptions = rippleFrameOptions(metadata ? Math.floor(metadata.duration * 24) : 0)
  const frames = draft.frames
  const durationPreset = draft.lengthMode === 'preset' ? LTX_RIPPLE_PRESET_SECONDS.find(seconds => rippleFramesForSeconds(seconds) === frames) : undefined
  let batchCount = 0
  let batchProblem = ''
  if (draft.longMode && metadata) {
    try { batchCount = planRippleChunks(metadata.duration, draft.chunkSeconds, draft.overlapSeconds).length; if (batchCount < 2) batchProblem = '此片段可一次处理完成。请关闭长视频模式。' }
    catch (reason) { batchProblem = reason instanceof Error ? reason.message : String(reason) }
  }
  const size = resolveFrameSize(metadata, draft.resolution)
  const blendTransitions = draft.blendTransitions && draft.overlapSeconds > 0
  const running = Boolean(latestJob && ['queued', 'running'].includes(latestJob.status))
  const preparing = working || submitting
  const announcedStage = latestJob?.progressLabel?.replace(/\s*·\s*step \d+ of \d+/i, '') ?? '正在渲染 Ripple 编辑'
  const missing = [
    ...(!connected ? ['在设置中连接 ComfyUI'] : []),
    ...(!modelReady ? ['安装 LTX 2.5 蒸馏模型、Gemma 编码器以及视频/音频 VAE'] : []),
    ...(connected && !lora ? ['Install LTX25_Ripple_v11.safetensors in ComfyUI/models/loras'] : []),
    ...(connected && missingNodes.length ? [`Enable these ComfyUI nodes: ${missingNodes.join(', ')}`] : []),
    ...(draft.livePreview && draft.previewMode === 'sampling-override' && !samplingPreviewNodeType ? ['安装或启用 ComfyUI-KJNodes 中的 LTX2SamplingPreviewOverride 以获取采样预览'] : []),
  ]
  const canRender = Boolean(draft.source && draft.editedFrame && editedSize && size && (draft.longMode ? batchCount >= 2 && !batchProblem : frameOptions.includes(frames) && (draft.lengthMode !== 'custom' || draft.customSeconds >= 2 && draft.customSeconds <= 20)) && !missing.length && !busy && !working && !submitting && !running)
  const render = async () => {
    if (!draft.source || !draft.editedFrame || !size || !frames || !canRender) return
    setWorking(true); setError('')
    try {
      const options: LtxRippleOptions = { prompt: draft.prompt, negativePrompt: draft.negativePrompt, width: size.width, height: size.height, frames, strength: draft.strength, guideStrength: draft.guideStrength, seed: draft.seed, filenamePrefix: 'LTX_Ripple/FFAF', livePreview: draft.livePreview, previewOverride: draft.livePreview && draft.previewMode === 'sampling-override' && samplingPreviewNodeType ? { nodeType: samplingPreviewNodeType, fps: 24 } : undefined }
      const problem = draft.longMode ? await onGenerateLong(options, draft.source, draft.editedFrame, draft.chunkSeconds, draft.overlapSeconds, blendTransitions) : await onGenerate(options, draft.source, draft.editedFrame)
      if (problem) setError(problem)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setWorking(false) }
  }
  return <div className="ripple-workspace">
    <header className="ripple-heading"><div><span className="ripple-kicker">LTX 2.5 · FIRST FRAME ALL FRAMES</span><h1>Ripple</h1><p>Change the first frame. Carry that edit through the original clip’s motion and timing.</p></div><button type="button" className="ripple-reset" disabled={preparing} onClick={() => { localStorage.removeItem(storageKey); setDraft({ ...initialDraft, seed: Math.floor(Math.random() * 1_000_000_000) }); setError('') }}><RotateCcw size={15}/> 重置输入</button></header>
    <div className="ripple-grid">
      <div className="ripple-controls">
        <section className="ripple-card"><div className="ripple-section-title"><span>01</span><div><h2>源运动</h2><p>Video supplies movement, composition, timing and audio.</p></div></div>{sourceUrl ? <div className="ripple-source"><ReliableVideo src={sourceUrl} controls preload="metadata" playsInline /></div> : <button className="ripple-source" type="button" onClick={() => void choose('video')}><span className="ripple-empty-media"><Video size={28}/><strong>选择源视频</strong><small>MP4 or another supported local clip</small></span></button>}{draft.source && <div className="ripple-file-row"><span title={draft.source.path}>{draft.source.name}</span><button type="button" onClick={() => void choose('video')}>Replace</button></div>}{busy && <p className="ripple-muted" role="status"><LoaderCircle size={14} className="ripple-spin"/> {busy}…</p>}{metadata && <p className="ripple-muted">{metadata.width} × {metadata.height} · {metadata.duration.toFixed(1)} s · {metadata.frameCount} frames</p>}</section>
        <section className="ripple-card"><div className="ripple-section-title"><span>02</span><div><h2>编辑后的首帧</h2><p>Make this image the opening frame of the edited video.</p></div></div><div className="ripple-frame-compare"><div><small>ORIGINAL FRAME 0</small><div className="ripple-frame">{sourceFirstUrl ? <img src={sourceFirstUrl} alt="从源片段提取的首帧"/> : <Film size={27}/>}</div>{sourceFirstFrame && size && <button className="ripple-edit-frame" type="button" onClick={() => onEditFirstFrame(sourceFirstFrame, size)}><Sparkles size={14}/> Edit this frame with FireRed <ArrowRight size={14}/></button>}</div><ArrowRight size={20} aria-hidden="true"/><div><small>REPLACEMENT FRAME 0</small><button className="ripple-frame ripple-frame-button" type="button" onClick={() => void choose('image')}>{editedUrl ? <img src={editedUrl} alt="选中的替换帧" onLoad={event => setEditedSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => { setEditedSize(null); setError('替换图像无法解码。请选择支持的 PNG、JPEG 或 WebP 图像。') }}/> : <span><ImagePlus size={25}/> 选择图片</span>}</button></div></div>{draft.editedFrame && <div className="ripple-file-row"><span title={draft.editedFrame.path}>{draft.editedFrame.name}</span><button type="button" onClick={() => void choose('image')}>Replace</button></div>}{editedSize && size && (editedSize.width !== size.width || editedSize.height !== size.height) && <p className="ripple-warning" role="status">Replacement is {editedSize.width} × {editedSize.height}; Ripple will scale and center crop it to {size.width} × {size.height}. Set the same size in Photo Edit to avoid resampling.</p>}</section>
        <section className="ripple-card"><div className="ripple-section-title"><span>03</span><div><h2>指导编辑</h2><p>仅描述需要改变或保持一致的内容。</p></div></div><label className="ripple-field">Edit prompt<textarea value={draft.prompt} rows={4} onChange={event => patch({ prompt: event.target.value })} placeholder={LTX_RIPPLE_DEFAULT_PROMPT}/></label><details className="ripple-advanced"><summary>高级控制</summary><label className="ripple-field">负面提示词<textarea value={draft.negativePrompt} rows={2} onChange={event => patch({ negativePrompt: event.target.value })}/></label><label className="ripple-field">Ripple 强度 <output>{draft.strength.toFixed(2)}</output><input type="range" min="0.5" max="2" step="0.05" value={draft.strength} onChange={event => patch({ strength: Number(event.target.value) })}/></label><label className="ripple-field">运动引导强度 <output>{draft.guideStrength.toFixed(2)}</output><input type="range" min="0.5" max="1" step="0.05" value={draft.guideStrength} onChange={event => patch({ guideStrength: Number(event.target.value) })}/></label><small className="ripple-muted">Lower values loosen the source-video guide; full strength best preserves its motion.</small><label className="ripple-field">Seed<input type="number" min="0" max="2147483647" value={draft.seed} onChange={event => patch({ seed: Number(event.target.value) })}/></label></details></section>
      </div>
      <aside className="ripple-output"><section className="ripple-card ripple-render-card"><div className="ripple-section-title"><span>04</span><div><h2>渲染跨度</h2><p>Ripple edits the beginning of the source clip at 24 fps.</p></div></div>
        <label className="ripple-long-toggle"><input type="checkbox" checked={draft.longMode} onChange={event => patch({ longMode: event.target.checked })}/> 分块处理整个视频</label>
        {draft.longMode ? <div className="ripple-long-settings"><label className="ripple-field">分块长度<select value={draft.chunkSeconds} onChange={event => patch({ chunkSeconds: Number(event.target.value) })}><option value="5">5 seconds · lower memory</option><option value="10">10 seconds · more context</option><option value="15">15 seconds · high memory</option></select></label><label className="ripple-field">Overlap<select value={draft.overlapSeconds} onChange={event => { const overlapSeconds = Number(event.target.value); patch({ overlapSeconds, blendTransitions: overlapSeconds > 0 && draft.blendTransitions }) }}><option value="0">None</option><option value="0.3333333333333333">⅓ second</option><option value="0.6666666666666666">⅔ second</option><option value="1">1 second</option><option value="2">2 seconds</option></select></label><label className="ripple-long-toggle"><input type="checkbox" checked={blendTransitions} disabled={draft.overlapSeconds === 0} onChange={event => patch({ blendTransitions: event.target.checked })}/> 过渡混合</label><p className="ripple-muted">{batchCount ? `${batchCount} sequential chunks · ${(metadata?.duration ?? 0).toFixed(1)} s source · original audio retained` : '选择一段 2 秒到 5 分钟的源素材。'}</p><small>Each chunk starts from an edited frame extracted at the previous chunk’s overlap. Keep the app open until assembly finishes.</small>{batchProblem && <p className="ripple-warning" role="status">{batchProblem}</p>}</div> : <>
          <label className="ripple-field">Ripple 编辑长度<select aria-label="Ripple 编辑长度" value={durationPreset ?? 'custom'} onChange={event => { const seconds = Number(event.target.value); if (Number.isFinite(seconds)) patch({ lengthMode: 'preset', frames: rippleFramesForSeconds(seconds) }); else patch({ lengthMode: 'custom', customSeconds: Math.min(20, Math.max(2, frames / 24)) }) }}><option value="custom">Custom</option>{LTX_RIPPLE_PRESET_SECONDS.map(seconds => <option key={seconds} value={seconds} disabled={metadata ? !frameOptions.includes(rippleFramesForSeconds(seconds)) : false}>{seconds} seconds</option>)}</select></label>
          {!durationPreset && <label className="ripple-field">自定义秒数<input type="number" min="2" max="20" step="0.1" value={draft.customSeconds} onChange={event => { const seconds = Number(event.target.value); patch({ customSeconds: seconds, ...(seconds >= 2 && seconds <= 20 ? { frames: rippleFramesForSeconds(seconds) } : {}) }) }}/></label>}
          <p className="ripple-muted">{frames} frames · {(frames / 24).toFixed(2)} s output · {frames - 1} source frames. LTX rounds to 8n + 1 frames.</p>
          {frames > 121 && <p className="ripple-warning" role="status">Long single passes need more VRAM and time. Ripple uses tiled guide encoding above 5 seconds, but a 10–20 second pass may still run out of memory.</p>}
        </>}
        <FrameResolutionControl source={metadata} value={draft.resolution} onChange={resolution => patch({ resolution })}/>
        <div className="ripple-preview-controls"><label><input type="checkbox" checked={draft.livePreview} onChange={event => patch({ livePreview: event.target.checked })}/> Live preview</label><select aria-label="预览源" value={draft.previewMode} disabled={!draft.livePreview} onChange={event => patch({ previewMode: event.target.value as RippleDraft['previewMode'] })}><option value="standard">标准解码帧</option><option value="sampling-override" disabled={!samplingPreviewNodeType}>LTX sampling · 24 fps</option></select><small>{draft.livePreview ? liveConnected ? draft.previewMode === 'sampling-override' ? 'Connected · sampling frames appear during rendering' : 'Connected · decoded frame appears near completion' : 'Connecting to ComfyUI preview…' : 'Preview off · progress and saved video remain available'}</small></div>
        {size && <div className="ripple-facts"><span>Output <strong>{size.width} × {size.height}</strong></span><span>Adapter <strong>Ripple v11 · {draft.strength.toFixed(2)}</strong></span><span>Sampler <strong>8 steps · Euler</strong></span></div>}
        {metadata && !draft.longMode && !frameOptions.includes(frames) && <p className="ripple-warning">This source is too short for the selected span. Choose a shorter length or a longer clip.</p>}
        {missing.length > 0 && <div className="ripple-warning" role="status"><strong>需要设置</strong>{missing.map(message => <p key={message}>{message}</p>)}</div>}{error && <p className="ripple-error" role="alert">{error}</p>}<button type="button" className="ripple-generate" onClick={() => void render()} disabled={!canRender}>{working || submitting ? <LoaderCircle size={17} className="ripple-spin"/> : <Sparkles size={17}/>} {working || submitting ? 'Preparing Ripple…' : draft.longMode ? '渲染整个视频' : '渲染 Ripple 编辑'}</button><small className="ripple-render-note">Your source is preserved. Rendering uses a normalized copy of the selected span.</small></section>
      <section className="ripple-card ripple-result"><div className="ripple-result-heading"><div><small>OUTPUT</small><h2>已编辑视频</h2></div>{latestJob && <span className={`status-badge ${latestJob.status}`}>{latestJob.status}</span>}</div>{running && draft.livePreview && livePreview && livePreview.promptId === (batchPromptId ?? latestJob?.promptId) && <figure className="ripple-live-preview">{livePreview.mime.startsWith('video/') ? <video src={livePreview.url} aria-label="LTX Ripple 实时采样预览" autoPlay muted loop playsInline/> : <img src={livePreview.url} alt="LTX Ripple 实时采样预览"/>}<figcaption>{draft.previewMode === 'sampling-override' ? 'LTX 采样预览' : '已解码首帧'}{livePreview.step && livePreview.totalSteps ? ` · step ${livePreview.step} of ${livePreview.totalSteps}` : ''}</figcaption></figure>}{running && <span className="sr-only" role="status" aria-live="polite">{announcedStage}</span>}<div className="ripple-result-stage">{running ? <div className="ripple-result-empty"><LoaderCircle size={27} className="ripple-spin"/><strong>{latestJob?.progressLabel || '正在渲染 Ripple 编辑'}</strong><span>{Math.round(latestJob?.progress ?? 0)}% · ComfyUI</span></div> : latestJob?.outputUrl ? <ReliableVideo src={latestJob.outputUrl} controls preload="metadata" playsInline/> : <div className="ripple-result-empty"><Upload size={27}/><strong>Your edited clip appears here</strong><span>Choose a source and edited first frame to start.</span></div>}</div>{latestJob?.status === 'failed' && <p className="ripple-error" role="alert">{latestJob.error || '渲染失败。请检查 ComfyUI 并重试。'}</p>}{running && latestJob && <button type="button" className="ripple-cancel" onClick={() => onCancel(latestJob)}>取消渲染</button>}{latestJob && <VideoExportButtons job={latestJob}/>}</section></aside>
    </div>
  </div>
}
