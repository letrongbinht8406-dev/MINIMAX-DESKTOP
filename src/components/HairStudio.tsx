import { AssetLibraryRail } from './AssetLibraryRail'
import { useEffect, useMemo, useState } from 'react'
import { Check, CircleStop, ImagePlus, LoaderCircle, Scissors, Sparkles, Trash2, WandSparkles, X } from 'lucide-react'
import { HAIR_LIBRARY_EVENT, loadHairStyleProjects, newHairStyleProject, saveHairStyleProjects } from '../lib/hairLibrary'
import { choices, type ObjectInfo } from '../lib/comfyInfo'
import { buildZImage } from '../lib/zimage'
import { anyImageProviderAvailable, studioImagePrompt } from '../lib/imageProviders/studio'
import { resolveAttentionBackend } from '../lib/attentionBackend'
import type { AppSettings, HairStyleProject, MediaFile } from '../types'
import { ReferenceApprovalModal } from './ReferenceApprovalModal'
import { resolveLlmConnection } from '../lib/llmProvider'
import { analyzeReferenceImage } from '../lib/referenceAnalysis'

function cleanPrompt(value: string) {
  return value.replace(/\\\s*(?:\r?\n|$)/g, ' ').replace(/[*_#`]+/g, '').replace(/\s+/g, ' ').trim()
}

export function HairStudio({ settings, info, connected, ollamaAvailable, onNotice }: { settings: AppSettings; info: ObjectInfo; connected: boolean; ollamaAvailable: boolean; onNotice(tone: 'error' | 'success' | 'neutral', text: string): void }) {
  const initial = useMemo(() => { const saved = loadHairStyleProjects(); return saved.length ? saved : [newHairStyleProject()] }, [])
  const [projects, setProjects] = useState(initial)
  const [activeId, setActiveId] = useState(initial[0].id)
  const [job, setJob] = useState<{ id: string; url: string; hairStyleId: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [assisting, setAssisting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [candidate, setCandidate] = useState<{ hairStyleId: string; file: MediaFile } | null>(null)
  const active = projects.find((item) => item.id === activeId) ?? projects[0]
  const llm = resolveLlmConnection(settings)
  const commit = (next: HairStyleProject[]) => { setProjects(next); saveHairStyleProjects(next) }
  const patch = (change: Partial<HairStyleProject>) => commit(projects.map((item) => item.id === active.id ? { ...item, ...change, updatedAt: Date.now() } : item))
  const patchById = (id: string, change: Partial<HairStyleProject>) => setProjects((current) => { const next = current.map((item) => item.id === id ? { ...item, ...change, updatedAt: Date.now() } : item); saveHairStyleProjects(next); return next })
  useEffect(() => { const refresh = () => { const next = loadHairStyleProjects(); if (next.length) setProjects(next) }; window.addEventListener(HAIR_LIBRARY_EVENT, refresh); return () => window.removeEventListener(HAIR_LIBRARY_EVENT, refresh) }, [])

  const prompt = active.referencePrompt.trim() || [
    `Professional three-view hairstyle design board for “${active.name}”.`,
    active.description,
    `Hair texture: ${active.texture}. Hair length: ${active.length}.`,
    active.color && `Exact hair color and tonal variation: ${active.color}.`,
    `Hairline and part: ${active.hairline}. Finish: ${active.finish}.`,
    `${active.visualStyle}. Show the exact same hairstyle from front, clean side profile, and back on one neutral featureless salon mannequin head. Hair is the only subject: preserve exact silhouette, volume, parting, fringe, layers, curl or braid pattern, edges, length, and color in every view. Crop from upper shoulders to above the head. Seamless mid-gray background, soft even salon lighting, sharp individual strands, no facial identity, no clothing details, no jewelry, no hat, no hands, no text, no labels, no logo, no duplicate hairstyle, no fantasy ornaments unless specified.`,
  ].filter(Boolean).join(' ')
  const zModel = choices(info, 'UNETLoader', 'unet_name').find((name) => /z[_-]?image.*turbo/i.test(name)) ?? 'z_image_turbo_bf16.safetensors'
  const zEncoder = choices(info, 'CLIPLoader', 'clip_name').find((name) => /qwen[_-]?3[_-]?4b/i.test(name)) ?? 'qwen_3_4b.safetensors'
  const zVae = choices(info, 'VAELoader', 'vae_name').find((name) => /^ae\.safetensors$/i.test(name)) ?? 'ae.safetensors'
  const zLegacyFiles = choices(info, 'UNETLoader', 'unet_name').includes(zModel) && choices(info, 'CLIPLoader', 'clip_name').includes(zEncoder) && choices(info, 'VAELoader', 'vae_name').includes(zVae)
  const zReady = connected && (zLegacyFiles || anyImageProviderAvailable(info, settings.customImageModels ?? []))
  const buildStill = (text: string, width: number, height: number, legacySteps: number): unknown => {
    const explicit = settings.imageProviderId
    if (explicit && explicit !== 'auto') {
      const picked = studioImagePrompt(info, explicit, { prompt: text, width, height }, settings.customImageModels ?? [])
      if (picked.ok) return picked.prompt
    }
    if (zLegacyFiles) return buildZImage(text, width, height, Math.floor(Math.random() * 1_000_000_000), zModel, zEncoder, zVae, legacySteps, 1, 'turbo', '', resolveAttentionBackend(settings.attentionBackend, choices(info, 'ModelAttentionBackend', 'attention')))
    const fallback = studioImagePrompt(info, null, { prompt: text, width, height }, settings.customImageModels ?? [])
    if (fallback.ok) return fallback.prompt
    throw new Error('No image model available: please install the Z-Image Turbo or Qwen-Image model set and rescan.')
  }

  const enhance = async () => {
    if (!ollamaAvailable || assisting) return
    setAssisting(true)
    try {
      const result = await window.minimax.generateWithOllama(llm.url, llm.model, `Rewrite these notes as one precise hairstyle reference prompt. Preserve exact texture, curl or braid pattern, silhouette, length, layers, part, fringe, hairline, edges, color, tonal variation, volume, and finish. Describe hair only; never invent a face, person, outfit, jewelry, headwear, or accessory. End with: the same hairstyle shown from front, side, and back on a neutral featureless salon mannequin head, upper-shoulder crop, mid-gray background, even studio lighting, sharp individual strands, no text or labels. Return one plain-text paragraph only.\n\nName: ${active.name}\nDesign: ${active.description}\nTexture: ${active.texture}\nLength: ${active.length}\nColor: ${active.color}\nHairline and part: ${active.hairline}\nFinish: ${active.finish}`, llm.provider)
      patch({ referencePrompt: cleanPrompt(result) }); onNotice('success', `Hair design prompt refined locally with ${llm.label}.`)
    } catch (cause) { onNotice('error', cause instanceof Error ? cause.message : String(cause)) }
    finally { setAssisting(false) }
  }
  const chooseImage = async () => { const picked = await window.minimax.chooseMedia('image'); if (!picked) return; const projectId = active.id; patch({ referenceImage: { ...picked, kind: 'image', preview: await window.minimax.mediaUrl(picked.path) } }); if (!ollamaAvailable) { onNotice('neutral', '图片已添加。连接本地视觉模型可自动填充发型档案。'); return } onNotice('neutral', 'Image added. The local vision model is filling empty hair fields…'); try { const result = await analyzeReferenceImage(settings, picked.path, 'hair'); const current = loadHairStyleProjects().find((item) => item.id === projectId); if (!current) return; const textures = ['直顺光滑','柔和波浪','清晰波浪','松散卷发','紧密卷曲','自然卷曲发质','locs','方块辫','cornrows','twists','寸头质感','自然发质']; const lengths = ['shaved','cropped','齐耳长度','齐下巴长度','及肩长度','中等长度','及中背长度','及腰长度']; patchById(projectId, { name: !current.name.trim() || /^Hair design \d+$/i.test(current.name) ? result.name || current.name : current.name, description: current.description.trim() ? current.description : result.description, texture: current.texture !== '自然发质' || !textures.includes(result.texture) ? current.texture : result.texture, length: current.length !== '中等长度' || !lengths.includes(result.length) ? current.length : result.length, color: current.color.trim() ? current.color : result.color, hairline: current.hairline !== '自然发际线' ? current.hairline : result.hairline || current.hairline, finish: current.finish !== '柔顺自然' ? current.finish : result.finish || current.finish, visualStyle: current.visualStyle !== '高端沙龙参考摄影' ? current.visualStyle : result.visualStyle || current.visualStyle }); onNotice('success', 'Existing image analyzed; empty hair fields were filled for review.') } catch (reason) { onNotice('error', `The image was added, but automatic description failed: ${reason instanceof Error ? reason.message : String(reason)}`) } }
  const createReference = async () => {
    if (!zReady || busy || !active.name.trim()) return
    setBusy(true); setError(false); setMessage('Submitting the hairstyle design board…')
    try { const response = await window.minimax.submitPrompt(settings.comfyUrl, buildStill(prompt, 1024, 1024, 8)); setJob({ id: response.prompt_id, url: settings.comfyUrl, hairStyleId: active.id }); setMessage('Rendering the hairstyle in ComfyUI…') }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : String(cause)); setError(true); setBusy(false) }
  }
  const cancel = async () => { if (!job) return; try { await window.minimax.cancelPrompt(job.url, job.id) } finally { setJob(null); setBusy(false); setMessage('发型渲染已取消。') } }
  useEffect(() => {
    if (!job) return
    let disposed = false; let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const history = await window.minimax.getHistory(job.url, job.id)
        const entry = history[job.id] as { status?: { status_str?: string }; outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }> } | undefined
        if (entry?.status?.status_str === 'error') throw new Error('发型生成失败，请检查 ComfyUI 日志。')
        const image = Object.values(entry?.outputs ?? {}).flatMap((output) => output.images ?? [])[0]
        if (image) { const preview = await window.minimax.getOutputImage(job.url, image); const saved = await window.minimax.saveComfyOutputImage(job.url, image, settings.outputDirectory); if (!disposed) { setCandidate({ hairStyleId: job.hairStyleId, file: { ...saved, preview, kind: 'image' } }); setBusy(false); setJob(null); setMessage('发型设计已就绪，等待审批。') }; return }
      } catch (cause) { if (!disposed) { setMessage(cause instanceof Error ? cause.message : String(cause)); setError(true); setBusy(false); setJob(null) }; return }
      timer = setTimeout(poll, 2000)
    }
    void poll(); return () => { disposed = true; clearTimeout(timer) }
  }, [job, settings.outputDirectory])

  const add = () => { const item = newHairStyleProject(projects.length + 1); commit([...projects, item]); setActiveId(item.id) }
  const remove = () => { if (!window.confirm(`Delete hair design “${active.name}”? The image remains on disk.`)) return; const next = projects.filter((item) => item.id !== active.id); const fallback = next.length ? next : [newHairStyleProject()]; commit(fallback); setActiveId(fallback[0].id) }

  return <><div className="standard-page character-studio hair-studio"><div className="page-heading"><div><p className="eyebrow">GLOBAL HAIR LIBRARY</p><h1>Hair Studio</h1><p>Design reusable hairstyles, approve a clean reference board, and assign one style to any character.</p></div><div className="heading-state"><span className={active.referenceImage ? 'ok' : 'warn'}>{active.referenceImage ? <Check size={15} /> : <Scissors size={15} />}{active.referenceImage ? '发型参考已就绪' : '创建一个发型参考'}</span></div></div><div className="character-studio-grid"><AssetLibraryRail title="发型设计" items={projects.map(item => ({ id: item.id, name: item.name, detail: `${item.texture} · ${item.referenceImage ? 'approved' : '需要图片'}`, preview: item.referenceImage?.preview, placeholder: <Scissors size={18} /> }))} activeId={active.id} onAdd={add} onSelect={setActiveId} /><section className="character-workbench"><header><div><Scissors size={18} /><span><strong>发型特征</strong><small>Hair stays separate from face identity so one character can change styles cleanly.</small></span></div><button className="danger-button" onClick={remove}><Trash2 size={14} />删除设计</button></header><div className="wardrobe-workspace"><section className="character-setup-panel"><div className="character-section-heading"><span><Scissors size={15} /></span><div><strong>设计档案</strong><small>Define the silhouette, texture, structure, color, and finish.</small></div></div><div className="character-form"><label>设计名称<input value={active.name} onChange={(event) => patch({ name: event.target.value, referencePrompt: '' })} /></label><label>Texture<select value={active.texture} onChange={(event) => patch({ texture: event.target.value, referencePrompt: '' })}>{['直顺光滑','柔和波浪','清晰波浪','松散卷曲','紧密卷发','自然螺旋卷','locs','方块辫','cornrows','twists','寸头质感','自然质感'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Length<select value={active.length} onChange={(event) => patch({ length: event.target.value, referencePrompt: '' })}>{['shaved','cropped','及耳长度','及下巴长度','及肩长度','中等长度','及中背长度','及腰长度'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Color<input value={active.color} onChange={(event) => patch({ color: event.target.value, referencePrompt: '' })} placeholder="Deep espresso brown with subtle warm highlights" /></label><label className="wide">Cut, shape, and styling details<textarea value={active.description} onChange={(event) => patch({ description: event.target.value, referencePrompt: '' })} placeholder="Silhouette, layers, fringe, fade, braiding pattern, volume, loose strands…" /></label><label>发际线与分缝<input value={active.hairline} onChange={(event) => patch({ hairline: event.target.value, referencePrompt: '' })} /></label><label>Finish<input value={active.finish} onChange={(event) => patch({ finish: event.target.value, referencePrompt: '' })} placeholder="Glossy, soft, wet look, flyaways…" /></label></div><div className="character-assist"><span><WandSparkles size={15} /><span><strong>提示词助手</strong><small>Turns the design profile into a precise hair-only reference prompt.</small></span></span><button className="secondary-button" disabled={!ollamaAvailable || assisting} onClick={() => void enhance()}>{assisting ? <LoaderCircle className="spin" size={14} /> : <WandSparkles size={14} />}{assisting ? 'Refining…' : '优化提示词'}</button></div></section><section className="character-setup-panel wardrobe-render-panel"><div className="character-section-heading"><span><Sparkles size={15} /></span><div><strong>Three-view hair reference</strong><small>A neutral mannequin board avoids importing another person's face.</small></div><em>{zReady ? 'Ready' : 'Unavailable'}</em></div><label className="character-reference-prompt"><span><strong>可编辑渲染提示词</strong><small>Front, side, and back consistency.</small></span><textarea value={prompt} onChange={(event) => patch({ referencePrompt: event.target.value })} /></label>{message && <div className={`character-master-message ${error ? 'error' : ''}`} role="status">{busy && <LoaderCircle className="spin" size={13} />}<span>{message}</span></div>}<footer><button className="secondary-button" disabled={busy} onClick={() => void chooseImage()}><ImagePlus size={14} />选择已有的</button>{busy && <button className="danger-button" onClick={() => void cancel()}><CircleStop size={14} />Cancel</button>}<button className="primary-button" disabled={busy || !zReady || !active.name.trim()} onClick={() => void createReference()}><Sparkles size={14} />{busy ? 'Creating…' : active.referenceImage ? '重新生成发型' : '创建发型参考'}</button></footer>{active.referenceImage && <figure className="accessory-reference-preview hair-reference-preview"><img src={active.referenceImage.preview} alt={`${active.name} hairstyle reference`} /><figcaption><span><Check size={13} />已批准的发型参考</span><button aria-label="移除发型参考" onClick={() => patch({ referenceImage: undefined })}><X size={13} /></button></figcaption></figure>}</section></div></section></div></div>{candidate && <ReferenceApprovalModal title="审批发型设计" description="Confirm that front, side, and back show one consistent hairstyle with the intended texture, silhouette, hairline, length, and color." image={candidate.file.preview ?? ''} approveLabel="审批发型参考" nextStep="在角色工作室中分配此样式。参考模式将保持与该角色的配对。" onClose={() => setCandidate(null)} onRetry={() => { setCandidate(null); void createReference() }} onApprove={() => { patchById(candidate.hairStyleId, { referenceImage: candidate.file }); setCandidate(null); onNotice('success', '发型设计已审批并添加到全局库。') }} />}</>
}
