import { useEffect, useState } from 'react'
import { LTX25_MAX_PIXELS, LTX25_RESOLUTIONS, ltx25ResolutionLabel } from '../lib/ltx25Resolutions'
import { MINIMAX_VIDEO_RESOLUTION_GROUPS } from '../lib/videoResolutions'

type Orientation = 'landscape' | 'ultrawide' | 'portrait' | 'square'

const imageSizes: Record<string, string[]> = {
  '16:9': ['1024x576', '1344x768', '1536x864', '1920x1080'],
  '3:2': ['1024x672', '1152x768', '1536x1024', '1920x1280'],
  '4:3': ['1024x768', '1280x960', '1536x1152', '1920x1440'],
  '1:1': ['768x768', '1024x1024', '1536x1536'],
  '4:5': ['768x960', '1024x1280', '1536x1920'],
  '3:4': ['768x1024', '960x1280', '1152x1536', '1440x1920'],
  '2:3': ['672x1024', '768x1152', '1024x1536', '1280x1920'],
  '9:16': ['576x1024', '768x1344', '864x1536', '1080x1920'],
}

export function RenderSize({ value, onChange, provider = 'minimax' }: { value: string; onChange(value: string): void; provider?: 'minimax' | 'ltx25' | 'zimage' }) {
  const [w, h] = value.split('x').map(Number)
  const orientation: Orientation = w === h ? 'square' : w / h >= 2.1 ? 'ultrawide' : w > h ? 'landscape' : 'portrait'
  const resolutionOptions: Record<Orientation, readonly string[]> = provider === 'ltx25' ? LTX25_RESOLUTIONS : MINIMAX_VIDEO_RESOLUTION_GROUPS
  const listed = resolutionOptions[orientation].includes(value)
  const [custom, setCustom] = useState(!listed)
  const [customWidth, setCustomWidth] = useState(Number.isFinite(w) ? w : 1344)
  const [customHeight, setCustomHeight] = useState(Number.isFinite(h) ? h : 768)
  useEffect(() => {
    const [nextWidth, nextHeight] = value.split('x').map(Number)
    if (Number.isFinite(nextWidth) && Number.isFinite(nextHeight)) {
      setCustomWidth(nextWidth); setCustomHeight(nextHeight)
    }
    setCustom(!Object.values(resolutionOptions).some((options) => options.includes(value)))
  }, [resolutionOptions, value])
  if (provider === 'zimage') {
    const ratio = Object.entries(imageSizes).find(([, options]) => options.includes(value))?.[0] ?? (w === h ? '1:1' : w > h ? '16:9' : '9:16')
    const area = w * h
    return <fieldset className="render-size image-render-size"><legend>图像画布</legend>
      <label>宽高比<select value={ratio} onChange={(event) => {
        const options = imageSizes[event.target.value]
        onChange(options.reduce((best, option) => {
          const [ow, oh] = option.split('x').map(Number)
          const [bw, bh] = best.split('x').map(Number)
          return Math.abs(ow * oh - area) < Math.abs(bw * bh - area) ? option : best
        }))
      }}>{Object.keys(imageSizes).map((option) => <option key={option} value={option}>{imageRatioLabel(option)}</option>)}</select></label>
      <label>分辨率<select value={value} onChange={(event) => onChange(event.target.value)}>{imageSizes[ratio].map((size) => <option key={size} value={size}>{size.replace('x', ' × ')} · {imageQualityLabel(size)}</option>)}</select></label>
      <p className="field-help">Z-Image 画布 · {(area / 1e6).toFixed(2)} 兆像素。画布越大占用 VRAM 越多、渲染越久。</p>
    </fieldset>
  }
  const maxPixels = provider === 'minimax' ? 1344 * 768 : LTX25_MAX_PIXELS
  const validCustom = customWidth >= 256 && customHeight >= 256 && customWidth % 32 === 0 && customHeight % 32 === 0 && customWidth * customHeight <= maxPixels
  const applyCustom = (width: number, height: number) => {
    setCustomWidth(width); setCustomHeight(height)
    if (width >= 256 && height >= 256 && width % 32 === 0 && height % 32 === 0 && width * height <= maxPixels) onChange(`${width}x${height}`)
  }
  return <fieldset className="render-size"><legend>输出尺寸</legend>
    <label>方向<select value={orientation} onChange={(e) => {
      const next = e.target.value as Orientation
      const options = resolutionOptions[next]
      const recommended = next === 'landscape' ? '1056x608' : next === 'ultrawide' ? '1216x512' : ''
      const preferred = recommended && options.includes(recommended) ? recommended : options.reduce((best, size) => Math.abs(size.split('x').map(Number).reduce((product, dimension) => product * dimension, 1) - w * h) < Math.abs(best.split('x').map(Number).reduce((product, dimension) => product * dimension, 1) - w * h) ? size : best)
      onChange(preferred)
    }}><option value="landscape">横向 · 16:9</option><option value="ultrawide">超宽 · 21:9</option><option value="portrait">竖向 · 9:16</option><option value="square">方形 · 1:1</option></select></label>
    <label>分辨率<select value={custom ? '__custom' : value} onChange={(e) => { if (e.target.value === '__custom') setCustom(true); else { setCustom(false); onChange(e.target.value) } }}>{resolutionOptions[orientation].map((size) => <option key={size} value={size}>{size.replace('x', ' × ')}{provider === 'minimax' ? ` · ${qualityLabel(size)}` : provider === 'ltx25' ? ` · ${ltx25ResolutionLabel(size)}` : ''}</option>)}<option value="__custom">自定义…</option></select></label>
    {custom && <div className="custom-resolution" role="group" aria-label="自定义输出分辨率"><label>宽度<input type="number" min="256" max="1920" step="32" value={customWidth} aria-invalid={!validCustom} onChange={(event) => applyCustom(Number(event.target.value), customHeight)} /></label><span aria-hidden="true">×</span><label>高度<input type="number" min="256" max="1920" step="32" value={customHeight} aria-invalid={!validCustom} onChange={(event) => applyCustom(customWidth, Number(event.target.value))} /></label></div>}
    <p className={`field-help ${custom && !validCustom ? 'error' : ''}`}>{custom && !validCustom ? `请使用 32 的倍数，至少 256 × 256，且在 ${(maxPixels / 1e6).toFixed(2)} 兆像素内。` : ''}{provider === 'ltx25' ? '1056 × 608 (16:9) 与 1216 × 512 (21:9) 是质量与速度兼顾的推荐项，像素量相近。质量模式先以一半尺寸生成，再进入官方 latent 2× 精化阶段。' : '1056 × 608 (16:9) 与 1216 × 512 (21:9) 是质量与速度兼顾的推荐项，像素量相近。所有选项均对齐 32 像素，输入裁切也遵循该尺寸。'} {(w * h / 1e6).toFixed(2)} 兆像素{provider === 'minimax' && (value === '1344x768' || value === '768x1344') ? ' · 原生 768p' : ''}</p>
  </fieldset>
}

function imageRatioLabel(ratio: string) {
  if (ratio === '16:9') return '宽屏 · 16:9'
  if (ratio === '3:2') return '照片横向 · 3:2'
  if (ratio === '4:3') return '经典横向 · 4:3'
  if (ratio === '1:1') return '方形 · 1:1'
  if (ratio === '4:5') return '竖向 · 4:5'
  if (ratio === '3:4') return '经典竖向 · 3:4'
  if (ratio === '2:3') return '照片竖向 · 2:3'
  return '竖版 · 9:16'
}

function imageQualityLabel(size: string) {
  const [width, height] = size.split('x').map(Number)
  const pixels = width * height
  if (pixels >= 2_000_000) return '最高'
  if (pixels >= 1_300_000) return '高'
  if (pixels >= 900_000) return '标准'
  return '快速'
}

function qualityLabel(size: string) {
  if (size === '1056x608' || size === '1216x512') return '推荐 · 质量 + 速度'
  const [width, height] = size.split('x').map(Number)
  const short = Math.min(width, height)
  if (short >= 768) return '原生质量'
  if (short >= 640) return '均衡'
  if (short >= 480) return '预览'
  return '草稿'
}
