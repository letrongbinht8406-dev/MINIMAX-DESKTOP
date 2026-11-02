import type { FrameResolution, FrameSize } from '../lib/frameResolution'
import { resolveFrameSize, sourceAspectChanges } from '../lib/frameResolution'
import './frame-resolution.css'

export function FrameResolutionControl({ source, value, onChange, disabled = false }: {
  source: FrameSize | null
  value: FrameResolution
  onChange(value: FrameResolution): void
  disabled?: boolean
}) {
  const output = resolveFrameSize(source, value)
  return <fieldset className="frame-resolution" disabled={disabled}>
    <legend>帧分辨率</legend>
    <label>输出尺寸<select value={value.mode} onChange={event => onChange({ ...value, mode: event.target.value as FrameResolution['mode'] })}>
      <option value="balanced">均衡 · 长边 768 px</option>
      <option value="detailed">精细 · 长边 1024 px</option>
      <option value="source">匹配源 · 最近有效尺寸</option>
      <option value="custom">自定义宽高</option>
    </select></label>
    {value.mode === 'custom' && <div className="frame-resolution-custom"><label>宽度<input type="number" min="256" max="2048" step="32" value={value.width} onChange={event => onChange({ ...value, width: Number(event.target.value) })}/></label><label>高度<input type="number" min="256" max="2048" step="32" value={value.height} onChange={event => onChange({ ...value, height: Number(event.target.value) })}/></label></div>}
    <p className="frame-resolution-summary" role="status">{source ? `源图 ${source.width} × ${source.height}` : '选择源图以计算尺寸'}{output ? ` → 输出 ${output.width} × ${output.height}` : ' · 输出尺寸不可用'}</p>
    {value.mode === 'source' && source && output && (source.width !== output.width || source.height !== output.height) && <small>已对齐到 LTX 最近的 32 倍数，源帧会被缩放并居中裁切少量像素。</small>}
    {source && output && sourceAspectChanges(source, output) && <small className="frame-resolution-warning">输出宽高比与源不同，帧将被居中裁切。</small>}
    {value.mode === 'custom' && !output && <small className="frame-resolution-warning">每边请使用 256–2048 像素，且为 32 的倍数。</small>}
    {output && Math.max(output.width, output.height) > 1024 && <small className="frame-resolution-warning">高分辨率需要更多 GPU 显存，在小显存卡上可能失败。</small>}
  </fieldset>
}
