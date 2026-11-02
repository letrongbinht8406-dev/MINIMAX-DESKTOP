import { Activity, CircleStop, ExternalLink, Film, History, Image as ImageIcon, LoaderCircle, Music2, Trash2 } from 'lucide-react'
import type { GenerationJob } from '../types'
import { modelLabel, modelPrecisionLabel, shortPrompt } from '../lib/jobPresentation'
import { MovieMediaThumbnail } from './MovieMediaThumbnail'

export function StatusBadge({ status }: { status: GenerationJob['status'] }) {
  return <span className={`status-badge ${status}`}>{status === 'running' && <LoaderCircle size={12} className="spin" />}{status}</span>
}

export function JobExecutionChips({ job, expanded = false }: { job: GenerationJob; expanded?: boolean }) {
  const execution = job.execution
  if (!execution) return null
  const chips = [
    execution.attentionBackend && { label: execution.attentionBackend, emphasis: /int8 attention|sage/i.test(execution.attentionBackend) },
    execution.diffusionPrecision && { label: execution.diffusionPrecision },
    execution.gpuRouting && { label: execution.gpuRouting, emphasis: /GPU 1|5060/i.test(execution.gpuRouting) },
    execution.sampler && { label: `${execution.sampler} + ${execution.scheduler ?? '调度器'}` },
    execution.preview && { label: `预览：${execution.preview}` },
    execution.upscale && execution.upscale !== 'Off' && { label: execution.upscale },
    execution.referenceCount !== undefined && { label: `${execution.referenceCount} 个参考素材` },
    ...(execution.adapters?.map((adapter) => ({ label: adapter })) ?? []),
    ...(expanded ? [
      execution.diffusionModel && { label: `模型：${modelLabel(execution.diffusionModel)}`, detail: execution.diffusionModel },
      execution.textEncoder && { label: `编码器：${modelPrecisionLabel(execution.textEncoder) ?? modelLabel(execution.textEncoder)}`, detail: execution.textEncoder },
    ] : []),
  ].filter((chip): chip is { label: string; emphasis?: boolean; detail?: string } => Boolean(chip))
  return chips.length ? <div className={`job-execution-chips ${expanded ? 'expanded' : ''}`} aria-label="渲染配置">{chips.map((chip) => <span key={`${chip.label}-${chip.detail ?? ''}`} className={chip.emphasis ? 'accelerated' : ''} title={chip.detail ?? chip.label}>{chip.label}</span>)}</div> : null
}

export function ComfyActivityConsole({ job }: { job: GenerationJob }) {
  const activity = job.comfyActivity ?? []
  const running = job.status === 'queued' || job.status === 'running'
  const fallback = running
    ? [{ at: job.createdAt, level: 'info' as const, message: job.promptId ? `ComfyUI 已接受提示词 ${job.promptId}，等待执行更新。` : '正在本地准备。该工作流尚未提交到 ComfyUI。' }]
    : []
  const entries = activity.length ? activity : fallback
  if (!entries.length) return null
  const latest = entries.at(-1)!
  return <details className={`comfy-activity-console ${job.status === 'failed' ? 'has-error' : ''}`} open={job.status === 'failed'}>
    <summary>
      <span><Activity size={14} />ComfyUI 活动</span>
      <small title={latest.message}>{latest.message}</small>
      <span className={`activity-state ${latest.level}`}>{running ? '实时' : job.status}</span>
    </summary>
    <div className="comfy-activity-log" role="log" aria-label="ComfyUI 活动日志" aria-live="polite">
      {entries.map((entry, index) => <div className={`comfy-activity-entry ${entry.level}`} key={`${entry.at}-${index}`}><time dateTime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</time><span>{entry.message}</span></div>)}
    </div>
  </details>
}

export function JobsView({ title, note, jobs, empty, cancellingIds, onCancel, onRemove }: { title: string; note: string; jobs: GenerationJob[]; empty: string; cancellingIds: Set<string>; onCancel(job: GenerationJob): Promise<void>; onRemove(job: GenerationJob): void }) {
  return <div className="standard-page">
    <div className="page-heading"><div><p className="eyebrow">本地工作区</p><h1>{title}</h1><p>{note}</p></div></div>
    {jobs.length === 0 ? <div className="empty-page"><History size={28} /><strong>{empty}</strong><span>新任务会自动保存在本设备上。</span></div> : <div className="job-list">{jobs.map((job) => {
      const audio = job.mediaType === 'audio'
      const image = job.mediaType === 'image'
      const active = job.status === 'running' || job.status === 'queued'
      return <article className={`job-row ${active ? 'constructing' : ''}`} key={job.id}>
        <div className={`job-thumbnail ${audio ? 'audio' : ''}`}>{job.outputUrl ? audio ? <Music2 /> : image ? <img src={job.outputUrl} alt="生成的参考静帧" /> : <span aria-label="视频输出"><MovieMediaThumbnail source={job.outputUrl} posterUrl={job.thumbnailUrl} /></span> : job.status === 'running' ? <LoaderCircle className="spin" /> : audio ? <Music2 /> : image ? <ImageIcon /> : <Film />}</div>
        <div className="job-copy"><div><StatusBadge status={job.status} /><span>{new Date(job.createdAt).toLocaleString()}</span></div><strong>{shortPrompt(job.prompt)}</strong><small>{audio ? `${job.provider === 'music3' ? 'Music 3' : 'ACE-Step'} · ${job.duration}s · 音频` : `${job.width} × ${job.height} · ${image ? 'Ref2VA 静帧' : `${job.duration}s · ${job.mode}`}`}</small><JobExecutionChips job={job} />{job.outputUrl && audio && <audio className="job-audio" src={job.outputUrl} controls preload="metadata" />}{active && <><small className="job-progress-label">{job.progressLabel ?? (job.status === 'queued' ? '队列中等待' : audio ? '本地生成音乐' : image ? '生成一张参考静帧' : '本地渲染中')}{job.queuePosition ? ` · 第 ${job.queuePosition} 位` : ''}{job.currentStep !== undefined && job.totalSteps ? ` · ${job.currentStep}/${job.totalSteps}` : ''}</small><div className="progress compact"><i style={{ width: `${job.progress}%` }} /></div></>}{job.error && <p className="job-error">{job.error}</p>}<ComfyActivityConsole job={job} /></div>
        <div className="job-actions">{job.outputUrl && <a className="secondary-button" href={job.outputUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />打开</a>}{active && <button className="danger-button" disabled={cancellingIds.has(job.id)} onClick={() => void onCancel(job)}>{cancellingIds.has(job.id) ? <LoaderCircle size={15} className="spin" /> : <CircleStop size={15} />}{cancellingIds.has(job.id) ? '停止中…' : '停止'}</button>}{!active && <button className="secondary-button" title="从队列历史移除；已渲染文件仍保留在磁盘" onClick={() => onRemove(job)}><Trash2 size={15} />移除</button>}</div>
      </article>
    })}</div>}
  </div>
}

