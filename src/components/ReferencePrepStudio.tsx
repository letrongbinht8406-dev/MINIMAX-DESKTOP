import { useEffect, useMemo, useState } from 'react'
import { Check, CircleStop, ImagePlus, Layers3, Scan, Send, Users, Watch, X } from 'lucide-react'
import { buildBiRefNetWorkflow } from '../lib/birefnetWorkflow'
import { buildReferenceBackgroundFillWorkflow } from '../lib/referenceBackgroundFillWorkflow'
import type { AppSettings, MediaFile } from '../types'
import type { ObjectInfo } from '../lib/comfyInfo'
import { CHARACTER_LIBRARY_EVENT, loadCharacterProjects, updateCharacterProject } from '../lib/characterLibrary'
import { ACCESSORY_LIBRARY_EVENT, loadAccessoryProjects, saveAccessoryProjects } from '../lib/accessoryLibrary'

type OutputImage = { filename: string; subfolder?: string; type?: string }
type PrepJob = { id: string; url: string; startedAt: number; completedPolls: number }
type PrepResult = { cutout: MediaFile; mask: MediaFile }
type AssignmentKind = 'character' | 'prop'
type FillStyle = 'studio' | 'scene'

const canvasSizes = {
  '1:1': [1024, 1024],
  '3:2': [1248, 832],
  '2:3': [832, 1248],
  '16:9': [1344, 756],
  '9:16': [756, 1344],
} as const

function loadPreview(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('无法读取所选预览以进行背景填充。'))
    image.src = src
  })
}

function drawCover(ctx: CanvasRenderingContext2D, image: CanvasImageSource, sourceWidth: number, sourceHeight: number, width: number, height: number) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight)
  const drawWidth = sourceWidth * scale
  const drawHeight = sourceHeight * scale
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
}

async function makeCharacterFill(sourcePreview: string, cutoutPreview: string, width: number, height: number, style: FillStyle) {
  const [source, cutout] = await Promise.all([loadPreview(sourcePreview), loadPreview(cutoutPreview)])
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('您的浏览器无法创建背景填充画布。')
  if (style === 'scene') {
    ctx.save()
    ctx.filter = 'blur(28px) saturate(0.8) brightness(0.72)'
    drawCover(ctx, source, source.naturalWidth, source.naturalHeight, width, height)
    ctx.restore()
    const shade = ctx.createLinearGradient(0, 0, 0, height)
    shade.addColorStop(0, 'rgba(7, 13, 20, 0.12)')
    shade.addColorStop(1, 'rgba(7, 13, 20, 0.38)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, width, height)
  } else {
    const plate = ctx.createLinearGradient(0, 0, width, height)
    plate.addColorStop(0, '#edf1f4')
    plate.addColorStop(1, '#cbd2d9')
    ctx.fillStyle = plate
    ctx.fillRect(0, 0, width, height)
  }
  const scale = Math.min((width * 0.88) / cutout.naturalWidth, (height * 0.88) / cutout.naturalHeight)
  const drawWidth = cutout.naturalWidth * scale
  const drawHeight = cutout.naturalHeight * scale
  ctx.drawImage(cutout, (width - drawWidth) / 2, height - drawHeight - height * 0.055, drawWidth, drawHeight)
  return canvas.toDataURL('image/png')
}

export function ReferencePrepStudio({ settings, info, connected, onUseCutout, onNotice, onOpenStudio }: {
  settings: AppSettings
  info: ObjectInfo
  connected: boolean
  onUseCutout(file: MediaFile): void
  onNotice(tone: 'error' | 'success' | 'neutral', text: string): void
  onOpenStudio(view: 'characters' | 'accessories'): void
}) {
  const [source, setSource] = useState<MediaFile | null>(null)
  const [job, setJob] = useState<PrepJob | null>(null)
  const [result, setResult] = useState<PrepResult | null>(null)
  const [characters, setCharacters] = useState(() => loadCharacterProjects())
  const [props, setProps] = useState(() => loadAccessoryProjects().filter((item) => item.category === 'prop' || item.category === 'other'))
  const [assignmentKind, setAssignmentKind] = useState<AssignmentKind>('character')
  const [assignmentId, setAssignmentId] = useState('')
  const [canvasRatio, setCanvasRatio] = useState<keyof typeof canvasSizes>('3:2')
  const [fillStyle, setFillStyle] = useState<FillStyle>('studio')
  const [assigning, setAssigning] = useState(false)
  const [message, setMessage] = useState('选择一张参考图，生成透明的身份或物体裁切。')
  const nativeReady = connected && Boolean(info.LoadBackgroundRemovalModel && info.RemoveBackground && info.JoinImageWithAlpha && info.MaskToImage)
  const busy = Boolean(job)
  const sourceLabel = useMemo(() => source?.name || '未选择源图', [source])
  const assignmentTargets = assignmentKind === 'character' ? characters : props

  useEffect(() => {
    const refreshCharacters = () => setCharacters(loadCharacterProjects())
    const refreshProps = () => setProps(loadAccessoryProjects().filter((item) => item.category === 'prop' || item.category === 'other'))
    refreshCharacters(); refreshProps()
    window.addEventListener(CHARACTER_LIBRARY_EVENT, refreshCharacters)
    window.addEventListener(ACCESSORY_LIBRARY_EVENT, refreshProps)
    return () => { window.removeEventListener(CHARACTER_LIBRARY_EVENT, refreshCharacters); window.removeEventListener(ACCESSORY_LIBRARY_EVENT, refreshProps) }
  }, [])

  useEffect(() => {
    if (assignmentTargets.some((target) => target.id === assignmentId)) return
    setAssignmentId(assignmentTargets[0]?.id ?? '')
  }, [assignmentId, assignmentTargets])

  const chooseSource = async () => {
    try {
      const picked = await window.minimax.chooseMedia('image')
      if (!picked) return
      setSource({ ...picked, kind: 'image', preview: await window.minimax.mediaUrl(picked.path), referenceRole: 'subject', referenceRetention: 'preserve' })
      setResult(null)
      setMessage('参考图已就绪。BiRefNet 将生成透明 PNG 和一个可独立编辑的前景遮罩。')
    } catch (error) { onNotice('error', `无法打开参考图：${error instanceof Error ? error.message : String(error)}`) }
  }

  const run = async () => {
    if (!source || !nativeReady || busy) return
    setMessage('正在将参考图上传到 ComfyUI…')
    try {
      const uploaded = await window.minimax.uploadInput(settings.comfyUrl, source.path)
      const response = await window.minimax.submitPrompt(settings.comfyUrl, buildBiRefNetWorkflow(uploaded, `reference-prep/BiRefNet_${Date.now()}`))
      setJob({ id: response.prompt_id, url: settings.comfyUrl, startedAt: Date.now(), completedPolls: 0 })
      setMessage('BiRefNet 正在分离前景并写入 alpha 遮罩…')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }

  const cancel = async () => {
    if (!job) return
    try { await window.minimax.cancelPrompt(job.url, job.id) }
    finally { setJob(null); setMessage('已取消背景移除。') }
  }

  const waitForBackgroundFill = async (promptId: string): Promise<MediaFile> => {
    for (;;) {
      const history = await window.minimax.getHistory(settings.comfyUrl, promptId)
      const entry = history[promptId] as { status?: { status_str?: string }; outputs?: Record<string, { images?: OutputImage[] }> } | undefined
      if (entry?.status?.status_str === 'error') throw new Error('ComfyUI 背景填充失败。请检查本地引擎日志后重试。')
      const output = Object.values(entry?.outputs ?? {}).flatMap((item) => item.images ?? [])[0]
      if (output) {
        const [preview, saved] = await Promise.all([
          window.minimax.getOutputImage(settings.comfyUrl, output),
          window.minimax.saveComfyOutputImage(settings.comfyUrl, output, settings.outputDirectory),
        ])
        return { ...saved, preview, kind: 'image', referenceRole: 'subject', referenceRetention: 'preserve', referenceType: 'full-body' }
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, 1200))
    }
  }

  const assignPreparedReference = async () => {
    if (!result || !source?.preview || !result.cutout.preview || !assignmentId || assigning) return
    const [width, height] = canvasSizes[canvasRatio]
    setAssigning(true)
    setMessage(`正在准备 ${canvasRatio} ${fillStyle === 'studio' ? '中性影棚' : '场景匹配'} 背景填充…`)
    try {
      const data = await makeCharacterFill(source.preview, result.cutout.preview, width, height, fillStyle)
      const uploaded = await window.minimax.uploadImageData(settings.comfyUrl, data)
      const response = await window.minimax.submitPrompt(settings.comfyUrl, buildReferenceBackgroundFillWorkflow(uploaded, `reference-prep/character-fill_${Date.now()}`))
      setMessage('ComfyUI 正在保存已填充背景的生产参考图…')
      const filled = await waitForBackgroundFill(response.prompt_id)
      if (assignmentKind === 'character') {
        const character = loadCharacterProjects().find((item) => item.id === assignmentId)
        if (!character) throw new Error('所选角色已不可用。')
        const alreadyAdded = character.referenceImages.some((item) => item.path === filled.path)
        if (!alreadyAdded && character.referenceImages.length >= 9) throw new Error(`${character.name} 已有最多的 9 张参考图。请先移除一个未使用的角度，再添加其他图。`)
        const referenceImages = alreadyAdded ? character.referenceImages : [...character.referenceImages, filled]
        const selectedReferencePaths = [...new Set([...(character.selectedReferencePaths ?? character.referenceImages.map((item) => item.path)), filled.path])]
        updateCharacterProject(character.id, { referenceImages, referenceMode: 'set', selectedReferencePaths })
        onNotice('success', `已将填充背景的参考图加入 ${character.name} 的已批准参考图。母图与源图保持不变。`)
        onOpenStudio('characters')
      } else {
        const prop = loadAccessoryProjects().find((item) => item.id === assignmentId)
        if (!prop) throw new Error('所选道具已不可用。')
        const next = loadAccessoryProjects().map((item) => item.id === prop.id ? { ...item, referenceImage: { ...filled, referenceRole: 'prop' as const }, updatedAt: Date.now() } : item)
        saveAccessoryProjects(next)
        onNotice('success', `已将填充背景的参考图分配给 ${prop.name}。`)
        onOpenStudio('accessories')
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      setMessage(text)
      onNotice('error', text)
    } finally { setAssigning(false) }
  }

  useEffect(() => {
    if (!job) return
    let disposed = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const history = await window.minimax.getHistory(job.url, job.id)
        const entry = history[job.id] as { status?: { status_str?: string; completed?: boolean }; outputs?: Record<string, { images?: OutputImage[] }> } | undefined
        if (entry?.status?.status_str === 'error') throw new Error('BiRefNet 在 ComfyUI 中失败。请确认当前 ComfyUI 构建与模型均已安装。')
        // Read the two named SaveImage nodes first. Depending on the ComfyUI
        // version, history can include other UI-bearing node outputs as well,
        // so raw object-value order is not a reliable cutout/mask contract.
        const outputs = Object.values(entry?.outputs ?? {}).flatMap((output) => output.images ?? [])
        const cutoutOutput = entry?.outputs?.['6']?.images?.[0] ?? outputs.find((output) => /_cutout(?:_|\.|$)/i.test(output.filename))
        const maskOutput = entry?.outputs?.['8']?.images?.[0] ?? outputs.find((output) => /_mask(?:_|\.|$)/i.test(output.filename))
        if (cutoutOutput && maskOutput) {
          const [cutoutPreview, maskPreview, cutoutSaved, maskSaved] = await Promise.all([
            window.minimax.getOutputImage(job.url, cutoutOutput),
            window.minimax.getOutputImage(job.url, maskOutput),
            window.minimax.saveComfyOutputImage(job.url, cutoutOutput, settings.outputDirectory),
            window.minimax.saveComfyOutputImage(job.url, maskOutput, settings.outputDirectory),
          ])
          if (!disposed) {
            setResult({
              cutout: { ...cutoutSaved, preview: cutoutPreview, kind: 'image', referenceRole: 'subject', referenceRetention: 'preserve' },
              mask: { ...maskSaved, preview: maskPreview, kind: 'image', referenceRole: 'subject', referenceRetention: 'guide' },
            })
            setJob(null)
            setMessage('裁切图与前景遮罩已就绪。保留原图用于构图；用裁切图作为身份或物体参考。')
          }
          return
        }
        const completed = entry?.status?.completed || entry?.status?.status_str === 'success'
        if (completed) {
          if (job.completedPolls >= 2) throw new Error('BiRefNet 已在 ComfyUI 中完成，但其保存的裁切图与遮罩未出现在 history 中。请检查两个 SaveImage 节点是否完成，以及 ComfyUI 能否写入其输出目录。')
          if (!disposed) {
            setJob({ ...job, completedPolls: job.completedPolls + 1 })
            setMessage('BiRefNet 已完成。正在收集已保存的裁切图与 alpha 遮罩…')
          }
          return
        }
      } catch (error) {
        if (!disposed) { setJob(null); setMessage(error instanceof Error ? error.message : String(error)) }
        return
      }
      timer = setTimeout(poll, 1600)
    }
    void poll()
    return () => { disposed = true; clearTimeout(timer) }
  }, [job, settings.outputDirectory])

  return <div className="standard-page reference-prep-studio">
    <div className="page-heading"><div><p className="eyebrow">参考准备 · 本地 COMFYUI</p><h1>参考准备</h1><p>将源图变成干净的身份/物体参考，同时不丢失原始构图源。</p></div><div className="heading-state"><span className={nativeReady ? 'ok' : 'warn'}>{nativeReady ? <Check size={15} /> : <Layers3 size={15} />}{nativeReady ? 'BiRefNet 就绪' : 'BiRefNet 需要配置'}</span></div></div>
    <div className="reference-prep-grid">
      <section className="reference-prep-panel"><header><span><Scan size={18} /><span><strong>1. 源参考图</strong><small>使用一张干净、光照良好的主体或道具图。原图仍可用于构图与风格。</small></span></span><button type="button" className="secondary-button" disabled={busy} onClick={() => void chooseSource()}><ImagePlus size={15} />选择图片</button></header>{source?.preview ? <figure className="reference-prep-source"><img src={source.preview} alt={source.name} /><figcaption>{sourceLabel}</figcaption></figure> : <div className="reference-prep-empty"><ImagePlus size={28} /><strong>选择图片</strong><span>在运行本地工作流之前不会上传任何内容。</span></div>}<footer><span>{message}</span>{busy ? <button type="button" className="danger-button" onClick={() => void cancel()}><CircleStop size={15} />取消</button> : <button type="button" className="primary-button" disabled={!source || !nativeReady} onClick={() => void run()}><Scan size={15} />移除背景</button>}</footer></section>
      <section className="reference-prep-panel"><header><span><Layers3 size={18} /><span><strong>2. 查看输出</strong><small>BiRefNet 写入透明 RGBA 裁切图，以及一个独立的灰度前景遮罩。</small></span></span></header>{result ? <div className="reference-prep-results"><figure><img src={result.cutout.preview} alt="透明前景裁切图" /><figcaption><strong>裁切图</strong><small>可直接用作 H3 镜头参考，或在分配给素材前先添加填充背景。</small><button type="button" className="secondary-button" onClick={() => onUseCutout(result.cutout)}><Send size={14} />用于镜头</button></figcaption></figure><figure><img src={result.mask.preview} alt="前景遮罩" /><figcaption><strong>遮罩</strong><small>已保存到本地，供清理或合成使用。</small></figcaption></figure></div> : <div className="reference-prep-empty"><Layers3 size={28} /><strong>暂无已准备好的输出</strong><span>处理后，请在使用裁切图生成前检查 alpha 边缘。</span></div>}<footer><span>原生节点链：LoadBackgroundRemovalModel → RemoveBackground → JoinImageWithAlpha。</span>{result && <button type="button" className="secondary-button" onClick={() => setResult(null)}><X size={14} />清除查看</button>}</footer></section>
    </div>
    <section className="reference-prep-assignment" aria-labelledby="reference-prep-assignment-title"><header><span><Users size={18} /><span><strong id="reference-prep-assignment-title">3. 分配给素材</strong><small>角色分配会先获得画布尺寸的背景填充，再通过 ComfyUI 保存后加入素材库。</small></span></span></header><div className="reference-prep-assignment-fields"><label>素材类型<select value={assignmentKind} disabled={assigning} onChange={(event) => setAssignmentKind(event.target.value as AssignmentKind)}><option value="character">角色</option><option value="prop">道具 / 配饰</option></select></label><label>{assignmentKind === 'character' ? '角色' : '道具'}<select value={assignmentId} disabled={assigning || !assignmentTargets.length} onChange={(event) => setAssignmentId(event.target.value)}><option value="">{assignmentTargets.length ? `选择一个 ${assignmentKind === 'character' ? '角色' : '道具'}` : `先创建一个 ${assignmentKind === 'character' ? '角色' : '道具'}`}</option>{assignmentTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label><label>画布宽高比<select value={canvasRatio} disabled={assigning} onChange={(event) => setCanvasRatio(event.target.value as keyof typeof canvasSizes)}>{Object.entries(canvasSizes).map(([ratio, [width, height]]) => <option key={ratio} value={ratio}>{ratio} · {width} × {height}</option>)}</select></label><label>背景填充<select value={fillStyle} disabled={assigning} onChange={(event) => setFillStyle(event.target.value as FillStyle)}><option value="studio">中性影棚背景</option><option value="scene">模糊源场景</option></select></label></div><footer><span>{assignmentKind === 'character' ? '第一张图成为角色母图；后续分配成为已选角色参考。' : '填充后的图像成为该道具的权威素材库参考。'}</span><button type="button" className="primary-button" disabled={!result || !source?.preview || !assignmentId || assigning || !connected} onClick={() => void assignPreparedReference()}>{assignmentKind === 'character' ? <Users size={15} /> : <Watch size={15} />}{assigning ? '正在填充背景…' : `分配给 ${assignmentKind === 'character' ? '角色' : '道具'}`}</button></footer></section>
    {!nativeReady && <section className="reference-prep-install" role="status"><strong>一次性 ComfyUI 配置</strong><span>更新 ComfyUI，将 <code>birefnet.safetensors</code> 放入 <code>ComfyUI/models/background_removal/</code>，然后重扫模型。此工具需要原生 <code>LoadBackgroundRemovalModel</code>、<code>RemoveBackground</code>、<code>JoinImageWithAlpha</code> 与 <code>MaskToImage</code> 节点。</span></section>}
  </div>
}
