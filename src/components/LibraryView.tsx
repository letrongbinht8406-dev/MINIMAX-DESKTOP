import { useEffect, useState } from 'react'
import { Bookmark, ExternalLink, Film, Gauge, History, ImagePlus, LoaderCircle, Play, Scissors, Sparkles, Watch, X } from 'lucide-react'
import type { AppSettings, GenerationJob, MediaFile } from '../types'
import { libraryPromptTitle, shortPrompt } from '../lib/jobPresentation'
import { FrameBookmarkStudio, type BookmarkVideo } from './FrameBookmarkStudio'
import { MovieMediaThumbnail } from './MovieMediaThumbnail'
import { VideoPlayer } from './VideoPlayer'

export function LibraryView({ jobs, settings, onEdit, onCreate, onUseLtx, onUseLastFrameReference, onNotice }: { jobs: GenerationJob[]; settings: AppSettings; onEdit(): void; onCreate(): void; onUseLtx(file: MediaFile): void; onUseLastFrameReference(job: GenerationJob, opening: { mode: 'match' | 'reframe' | 'arc'; cameraAngle?: string }): Promise<void>; onNotice(tone: 'error' | 'success' | 'neutral', text: string): void }) {
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState<'all' | 'minimax' | 'ltx25'>('all')
  const [mediaType, setMediaType] = useState<'all' | 'video' | 'image'>('all')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [bookmarkVideo, setBookmarkVideo] = useState<BookmarkVideo | null>(null)
  const [lightbox, setLightbox] = useState<GenerationJob | null>(null)
  const [rife, setRife] = useState<{ installed: boolean; executable?: string; error?: string } | null>(null)
  const [rifeBusyId, setRifeBusyId] = useState<string | null>(null)
  const [referenceBusyId, setReferenceBusyId] = useState<string | null>(null)
  const [openingMode, setOpeningMode] = useState<'match' | 'reframe' | 'arc'>('match')
  const [openingCameraAngle, setOpeningCameraAngle] = useState('侧面机位')
  const available = jobs.filter((job) => job.mediaType !== 'audio' && Boolean(job.outputUrl))
  const filtered = available.filter((job) => (provider === 'all' || (job.provider ?? 'minimax') === provider) && (mediaType === 'all' || (mediaType === 'image' ? job.mediaType === 'image' : job.mediaType !== 'image')) && (!query.trim() || job.prompt.toLowerCase().includes(query.trim().toLowerCase()))).sort((a, b) => sort === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt)
  const videos: BookmarkVideo[] = available.filter(job => job.mediaType !== 'image').map((job) => ({ id: `job-${job.id}`, name: shortPrompt(job.prompt), source: job.outputUrl!, duration: job.duration, provider: job.provider === 'ltxripple' ? 'ltxripple' : job.provider === 'ltx25' ? 'ltx25' : 'minimax' }))
  useEffect(() => {
    if (!lightbox) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [lightbox])
  useEffect(() => { void window.minimax.getRifeStatus().then(setRife).catch(() => setRife({ installed: false })) }, [])
  const runRife = async (job: GenerationJob, mode: 'fps-2x' | 'slow-motion') => {
    setRifeBusyId(job.id)
    try {
      let status = rife
      if (!status?.installed) { status = await window.minimax.installRife(); setRife(status) }
      if (!status?.installed) throw new Error(status?.error || 'RIFE 设置未完成。')
      const result = await window.minimax.interpolateVideo(job.outputUrl!, settings.outputDirectory, settings.ffmpegPath, mode)
      await window.minimax.showOutput(result.path)
      onNotice('success', mode === 'slow-motion' ? '使用 RIFE 创建的电影级慢动作渲染已打开其输出文件夹。' : '48 fps RIFE optical-flow render created and opened in its output folder.')
    } catch (error) { onNotice('error', error instanceof Error ? error.message : String(error)) } finally { setRifeBusyId(null) }
  }
  const addLastFrameReference = async (job: GenerationJob) => {
    setReferenceBusyId(job.id)
    try { await onUseLastFrameReference(job, openingMode === 'match' ? { mode: 'match' } : { mode: openingMode, cameraAngle: openingCameraAngle }) }
    catch (error) { onNotice('error', `无法创建末帧参考素材：${error instanceof Error ? error.message : String(error)}`) }
    finally { setReferenceBusyId(null) }
  }
  return <div className="standard-page library-page"><div className="page-heading"><div><p className="eyebrow">本地素材库</p><h1>视频库</h1><p>审阅渲染结果、收集可复用画面，或在不改动原件的情况下组装片段。</p></div><button className="primary-button" onClick={onEdit}><Scissors size={16} />打开影片编辑器</button></div>
    <div className="library-toolbar"><label><span>搜索渲染</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索提示词…" /></label><label><span>提供方</span><select value={provider} onChange={(event) => setProvider(event.target.value as typeof provider)}><option value="all">全部提供方</option><option value="minimax">MiniMax H3</option><option value="ltx25">LTX 2.5</option></select></label><label><span>媒体</span><select value={mediaType} onChange={(event) => setMediaType(event.target.value as typeof mediaType)}><option value="all">图像与视频</option><option value="video">视频</option><option value="image">图像</option></select></label><label><span>排序</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="newest">最新在前</option><option value="oldest">最早在前</option></select></label><div><strong>{filtered.length}</strong><span>共 {available.length} 个素材</span></div></div>
    {available.length === 0 ? <div className="empty-page library-first-run"><History size={28} /><strong>完成的渲染将保存在这里</strong><span>生成一段镜头开始建立素材库。完成的视频会自动保存在本设备上。</span><div className="library-first-run-actions"><button className="primary-button" onClick={onCreate}><Film size={15} />打开视频工作区</button><button className="secondary-button" onClick={onEdit}><Scissors size={15} />打开影片编辑器</button></div></div> : filtered.length === 0 ? <div className="empty-page compact"><Film size={25} /><strong>没有匹配这些筛选的结果。</strong><button className="secondary-button" onClick={() => { setQuery(''); setProvider('all'); setMediaType('all') }}>清除筛选</button></div> : <div className="library-grid">{filtered.map((job) => {
      const image = job.mediaType === 'image'
      const video = videos.find(item => item.id === `job-${job.id}`)
      const rifeBusy = rifeBusyId === job.id
      const title = libraryPromptTitle(job.prompt)
      return <article className="library-card" key={job.id}>
        <button type="button" className="library-card-media" onClick={() => setLightbox(job)} aria-label={`预览 ${title}`}>
          {image ? <img src={job.outputUrl} alt="" /> : <MovieMediaThumbnail source={job.outputUrl!} posterUrl={job.thumbnailUrl} />}
          <span className="library-media-play"><Play size={16} fill="currentColor" /></span>
          {!image && <span className="library-media-duration">{job.duration}s</span>}
        </button>
        <div className="library-card-body">
          <div className="library-card-meta"><span className={`library-provider ${job.provider === 'ltx25' || job.provider === 'ltxripple' ? 'ltx' : ''}`}>{image ? 'Ref2VA 静帧' : job.provider === 'ltxripple' ? 'LTX 涟漪' : job.provider === 'ltx25' ? 'LTX 2.5' : 'MiniMax H3'}</span><time dateTime={new Date(job.createdAt).toISOString()}>{new Date(job.createdAt).toLocaleDateString()}</time></div>
          <strong title={job.prompt}>{title}</strong>
          <small>{job.width} × {job.height} · {image ? '一张图像' : `${job.duration}s · ${job.mode}`}</small>
          <div className="library-card-actions">
            <button className="secondary-button" onClick={() => setLightbox(job)}><Watch size={15} />预览</button>
            {!image && video && <button className="primary-button" onClick={() => setBookmarkVideo(video)}><Bookmark size={15} />画面书签</button>}
            <a className="secondary-button" href={job.outputUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />打开文件</a>
          </div>
          {!image && <details className="library-rife"><summary><Gauge size={14} />RIFE 动态工具</summary><span>{rife?.installed ? '光流派生 · 原件保持不变。' : '首次使用时安装官方本地 RIFE 工具。'}</span><div><button className="secondary-button" disabled={Boolean(rifeBusyId)} onClick={() => void runRife(job, 'fps-2x')}>{rifeBusy ? <LoaderCircle className="spin" size={14} /> : <Gauge size={14} />}48 fps</button><button className="secondary-button" disabled={Boolean(rifeBusyId)} onClick={() => void runRife(job, 'slow-motion')}>{rifeBusy ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}电影级慢动作</button></div></details>}
        </div>
      </article>
    })}</div>}
    {lightbox && <div className="media-lightbox-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightbox(null) }}><section className="media-lightbox" role="dialog" aria-modal="true" aria-labelledby="library-preview-title"><header><span><small>素材库预览</small><strong id="library-preview-title">{shortPrompt(lightbox.prompt)}</strong></span><button className="icon-button" onClick={() => setLightbox(null)} aria-label="关闭预览"><X size={18} /></button></header><div className="media-lightbox-stage">{lightbox.mediaType === 'image' ? <img src={lightbox.outputUrl} alt="生成的参考静帧" /> : <VideoPlayer src={lightbox.outputUrl!} />}</div><footer><span>{lightbox.width} × {lightbox.height} · {lightbox.mediaType === 'image' ? '静帧图像' : `${lightbox.duration}s 视频`}</span><div className="media-lightbox-actions">{lightbox.mediaType !== 'image' && <div className="opening-frame-builder"><div><strong>下一镜头画面条件</strong><small>提取绝对末帧，然后选择原生 Frame 0 条件或仅参考引导。</small></div><fieldset disabled={referenceBusyId === lightbox.id}><legend>条件处理方式</legend><label><input type="radio" name="opening-treatment" checked={openingMode === 'match'} onChange={() => setOpeningMode('match')} /><span><strong>Frame 0 锚点</strong><small>在 frame_idx 0 处进行原生 Add Guide 条件；固定开场画面状态。</small></span></label><label><input type="radio" name="opening-treatment" checked={openingMode === 'reframe'} onChange={() => setOpeningMode('reframe')} /><span><strong>仅参考 · 重构</strong><small>在 H3 生成新的开场角度时引导场景一致性；不锁定 frame 0。</small></span></label><label><input type="radio" name="opening-treatment" checked={openingMode === 'arc'} onChange={() => setOpeningMode('arc')} /><span><strong>Frame 0 锚点，然后弧线</strong><small>先在 frame_idx 0 处进行原生引导，然后跟随所需的镜头运动。</small></span></label></fieldset>{openingMode !== 'match' && <label className="opening-camera-angle"><span>{openingMode === 'arc' ? '目标机位' : '开场机位'}</span><select value={openingCameraAngle} onChange={(event) => setOpeningCameraAngle(event.target.value)}><option value="侧面机位">侧机位</option><option value="四分之三机位">四分之三机位</option><option value="正面机位">正面机位</option><option value="低机位">低机位</option><option value="高机位">高机位</option><option value="过肩机位">过肩机位</option></select></label>}<button className="primary-button" disabled={referenceBusyId === lightbox.id} onClick={() => void addLastFrameReference(lightbox)} title="提取末帧并作为原生 Frame 0 锚点或仅参考重构源">{referenceBusyId === lightbox.id ? <LoaderCircle className="spin" size={15} /> : <ImagePlus size={15} />}{referenceBusyId === lightbox.id ? '正在提取末帧…' : openingMode === 'match' ? '使用原生 Frame 0 锚点' : openingMode === 'reframe' ? '使用仅参考重构' : '使用 Frame 0 锚点 + 弧线'}<small>实验性</small></button></div>}<button className="secondary-button" onClick={() => setLightbox(null)}>关闭</button></div></footer></section></div>}
    {bookmarkVideo && <FrameBookmarkStudio key={bookmarkVideo.id} initialVideo={bookmarkVideo} videos={videos} settings={settings} onClose={() => setBookmarkVideo(null)} onUseLtx={onUseLtx} onNotice={onNotice} />}
  </div>
}

