import { useEffect } from 'react'
import { Check, RefreshCw, Sparkles, X } from 'lucide-react'

export function ReferenceApprovalModal({ title, description, image, approveLabel, nextStep, approveStartsGeneration = false, onRetry, onApprove, onClose }: {
  title: string
  description: string
  image: string
  approveLabel: string
  nextStep?: string
  approveStartsGeneration?: boolean
  onRetry(): void
  onApprove(): void
  onClose(): void
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="modal-backdrop reference-approval-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="reference-approval-modal" role="dialog" aria-modal="true" aria-labelledby="reference-approval-title">
      <header><div><span><Sparkles size={18} /></span><div><strong id="reference-approval-title">{title}</strong><small>{description}</small></div></div><button onClick={onClose} aria-label="关闭参考审阅"><X size={18} /></button></header>
      <div className="reference-approval-preview"><img src={image} alt="待批准的生成参考图" /></div>
      <div className="reference-approval-status"><Check size={16} /><span><strong>待审核</strong><small>{nextStep ?? '批准后即将该结果加入参考素材库。'}</small></span></div>
      <footer><button className="secondary-button" onClick={onClose}>保留当前</button><button className="secondary-button generation-button" onClick={onRetry}><RefreshCw size={14} />重试</button><button className={`primary-button ${approveStartsGeneration ? 'generation-button' : ''}`} autoFocus onClick={onApprove}><Check size={14} />{approveLabel}</button></footer>
    </section>
  </div>
}
