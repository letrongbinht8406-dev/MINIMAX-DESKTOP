import { useEffect, useRef, useState } from 'react'
import type { MediaFile, ReferenceHandoffRole, ReferenceRetention } from '../types'
import { defaultCrop, drawPreparedImage, resolveImageBackground } from '../lib/imageCrop'

const referenceRoles: Array<{ value: ReferenceHandoffRole; label: string }> = [
  { value: 'subject', label: '主体 / 身份' },
  { value: 'wardrobe', label: '服装' },
  { value: 'prop', label: '道具 / 产品' },
  { value: 'location', label: '地点 / 布景' },
  { value: 'composition', label: '构图 / 姿态' },
  { value: 'lighting-style', label: '灯光 / 风格' },
]

export function ImageCrop({ file, resolution, onChange, label, handoff = false }: { file: MediaFile; resolution: string; onChange(file: MediaFile): void; label: string; handoff?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const crop = file.crop ?? defaultCrop
  useEffect(() => {
    let alive = true
    const [width, height] = resolution.split('x').map(Number)
    const prepared = document.createElement('canvas')
    void drawPreparedImage(prepared, file, width, height).then(() => {
      if (!alive || !canvas.current) return
      canvas.current.width = width
      canvas.current.height = height
      canvas.current.getContext('2d')!.drawImage(prepared, 0, 0)
      setError('')
    }).catch((e: Error) => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [file, resolution])
  return <section className="crop-editor" aria-label={`${label} crop`}>
    <canvas ref={canvas} aria-label={`${label} output crop preview`} />
    {error && <p role="alert">{error}</p>}
    <button type="button" className="secondary-button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '隐藏裁切控制' : '调整裁切'} · {resolution.replace('x', ' × ')}</button>
    {open && <div className="crop-controls">
      {handoff && <div className="reference-handoff-fields"><label>参考角色<select value={file.referenceRole ?? 'composition'} onChange={(event) => onChange({ ...file, referenceRole: event.target.value as ReferenceHandoffRole })}>{referenceRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label><label>保留度<select value={file.referenceRetention ?? 'guide'} onChange={(event) => onChange({ ...file, referenceRetention: event.target.value as ReferenceRetention })}><option value="guide">仅引导</option><option value="preserve">必须保留</option></select></label></div>}
      <label>图像适配<select value={crop.fit} onChange={(e) => onChange({ ...file, crop: { ...crop, fit: e.target.value as 'crop' | 'contain' } })}><option value="crop">填满画框 · 裁切边缘</option><option value="contain">完整显示 · 智能背景填充</option></select></label>
      {crop.fit === 'contain' && <label>背景处理<select value={crop.background ?? 'auto'} onChange={(event) => onChange({ ...file, crop: { ...crop, background: event.target.value as 'auto' | 'smart' | 'neutral' } })}><option value="auto">自动 · {resolveImageBackground(file) === 'neutral' ? '中性背景' : '场景延展'}</option><option value="neutral">中性色匹配背景</option><option value="smart">模糊场景延展</option></select></label>}
      {(['x', 'y', 'zoom'] as const).map((key) => <label key={key}>{key === 'x' ? '水平位置' : key === 'y' ? '垂直位置' : '缩放'}<input type="range" min={key === 'zoom' ? 1 : 0} max={key === 'zoom' ? 4 : 1} step="0.01" value={crop[key]} disabled={crop.fit === 'contain'} onChange={(e) => onChange({ ...file, crop: { ...crop, [key]: Number(e.target.value) } })} /><output>{key === 'zoom' ? `${crop[key].toFixed(2)}×` : `${Math.round(crop[key] * 100)}%`}</output></label>)}
      <button type="button" className="secondary-button" onClick={() => onChange({ ...file, crop: { ...defaultCrop } })}>重置为自动居中裁切</button>
      <p className="field-help">编辑立即应用于该交接预览，原始图片保持不变。</p>
    </div>}
  </section>
}
