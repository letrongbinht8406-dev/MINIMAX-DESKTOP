import { ProductionLoading } from './Workspace'
export function RenderConstruction({ state = 'running', label, progress }: { state?: string; label?: string; progress?: number }) {
 return <ProductionLoading label={label || (state === 'queued' ? '已排队 · 正在准备参考素材' : '处理中 · 等待引擎阶段')} progress={progress} />
}
