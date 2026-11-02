import { useState } from 'react'
import { Download } from 'lucide-react'
import type { GenerationJob } from '../types'

export function VideoExportButtons({ job }: { job: GenerationJob }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  if (job.status !== 'completed' || job.mediaType === 'image' || job.mediaType === 'audio' || !job.outputUrl) return null
  const save = async (segment: boolean) => {
    const source = segment ? job.segmentOutputPath ?? job.segmentOutputUrl : job.localOutputPath ?? job.outputUrl
    if (!source) return
    setBusy(true); setMessage(''); setFailed(false)
    try {
      const path = await window.minimax.exportVideo(source, `${job.outputName?.split('/').at(-1) ?? `Video-${job.id}`}${segment ? '_Beat' : ''}.mp4`)
      setMessage(path ? `已导出到 ${path}` : '已取消导出。')
    } catch (error) { setFailed(true); setMessage(`${error instanceof Error ? error.message : String(error)} 请重试导出。`) }
    finally { setBusy(false) }
  }
  return <div className="video-export-actions">
    {job.continuation && <button type="button" className="secondary-button" disabled={busy || !job.segmentOutputUrl} title={!job.segmentOutputUrl ? '重新生成此较早节拍以保存单独片段。' : '只保存此节拍，不含重复运动上下文'} onClick={() => void save(true)}><Download size={14} />导出节拍</button>}
    <button type="button" className="secondary-button" disabled={busy} onClick={() => void save(false)}><Download size={14} />{busy ? '导出中…' : job.continuation ? '导出合成视频' : '导出视频'}</button>
    {message && <small role={failed ? 'alert' : 'status'} aria-live="polite">{message}</small>}
  </div>
}
