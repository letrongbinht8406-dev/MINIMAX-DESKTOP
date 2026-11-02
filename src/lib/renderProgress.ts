import type { GenerationJob } from '../types'

type SamplerUpdate = Pick<GenerationJob, 'currentStep' | 'samplerPass'>

export function samplerTimingUpdate(job: GenerationJob | Pick<GenerationJob, 'currentStep' | 'samplerPass' | 'estimatedSamplerStepMs' | 'lastSamplerStepAt' | 'refinementStepCostMultiplier'>, update: SamplerUpdate, now: number) {
  const passChanged = Boolean(update.samplerPass && update.samplerPass !== job.samplerPass)
  if (passChanged) return {
    lastSamplerStepAt: undefined,
    estimatedSamplerStepMs: job.estimatedSamplerStepMs && update.samplerPass === 'refine'
      ? Math.round(job.estimatedSamplerStepMs * (job.refinementStepCostMultiplier ?? 1))
      : job.estimatedSamplerStepMs,
  }
  const stepDelta = update.currentStep !== undefined && job.currentStep !== undefined ? update.currentStep - job.currentStep : 0
  if (stepDelta <= 0) return { lastSamplerStepAt: job.lastSamplerStepAt, estimatedSamplerStepMs: job.estimatedSamplerStepMs }
  const measuredStepMs = job.lastSamplerStepAt && now > job.lastSamplerStepAt ? (now - job.lastSamplerStepAt) / stepDelta : undefined
  return {
    lastSamplerStepAt: now,
    estimatedSamplerStepMs: measuredStepMs
      ? Math.round(job.estimatedSamplerStepMs ? job.estimatedSamplerStepMs * 0.65 + measuredStepMs * 0.35 : measuredStepMs)
      : job.estimatedSamplerStepMs,
  }
}

export function nodeTimingUpdate(job: Pick<GenerationJob, 'activeNodeId' | 'activeNodeStartedAt' | 'lastNodeDurationMs'>, nodeId: string | null | undefined, now: number) {
  if (nodeId === undefined || nodeId === job.activeNodeId) return { activeNodeId: job.activeNodeId, activeNodeStartedAt: job.activeNodeStartedAt, lastNodeDurationMs: job.lastNodeDurationMs }
  return {
    activeNodeId: nodeId ?? undefined,
    activeNodeStartedAt: nodeId ? now : undefined,
    lastNodeDurationMs: job.activeNodeStartedAt && job.activeNodeId && now >= job.activeNodeStartedAt ? now - job.activeNodeStartedAt : job.lastNodeDurationMs,
  }
}

export function samplerPassForNode(nodeId: string, nodeType?: string): GenerationJob['samplerPass'] | undefined {
  if (nodeId === '38' || nodeId === '111') return 'refine'
  if (nodeId === '15' || nodeType === 'KSampler') return 'first'
  return undefined
}

export function nodeStageLabel(nodeType: string | undefined, nodeId: string) {
  const h3Stages: Record<string, string> = {
    '161': '正在准备动作上下文', '170': '加载续写源视频',
        '1701': '加载续写源音频', '171': '裁剪连续性重叠',
        '172': '合并源与新拍', '173': '编码新拍',
        '174': '保存新拍', '190': '保存可复用动作上下文',
  }
  if (h3Stages[nodeId]) return h3Stages[nodeId]
  if (!nodeType) return `正在运行节点 ${nodeId}`
  if (/^UNETLoader$/i.test(nodeType)) return '加载扩散模型'
  if (/^(CLIPLoader|DualCLIPLoader)$/i.test(nodeType)) return '加载文本编码器'
  if (/ModelAttentionBackend|SolAttnH3|MiniMaxH3AttentionParallel/i.test(nodeType)) return '应用注意力后端'
  if (/LoraLoader/i.test(nodeType)) return '应用 LoRA 适配器'
  if (/MiniMaxH3.*(?:Reference|Image)ToVideo/i.test(nodeType)) return '准备 H3 条件与参考素材'
  if (/MinimaxH3LatentUpscaler3DRefineHandoff/i.test(nodeType)) return '上采样并精修 H3 潜空间'
  if (/SamplerCustomAdvanced|KSampler$/i.test(nodeType)) return '启动采样器'
  if (/VAEDecode/i.test(nodeType)) return '解码视频帧'
  if (/CreateVideo/i.test(nodeType)) return '编码视频与音频'
  if (/Save(?:Video|Image|Audio)/i.test(nodeType)) return '保存输出'
  return `正在处理 ${nodeType}`
}

export function samplerProgressSummary(job: GenerationJob | undefined, now: number) {
  if (!job || job.status !== 'running' || job.currentStep === undefined || !job.totalSteps || job.totalSteps <= 0) return null
  const refinementSteps = Math.max(0, job.refinementSteps ?? 0)
  const firstSteps = refinementSteps && job.steps ? job.steps : job.totalSteps
  const totalSteps = firstSteps + refinementSteps
  const currentStep = Math.min(totalSteps, (job.samplerPass === 'refine' ? firstSteps : 0) + job.currentStep)
  const progress = Math.min(100, Math.round(currentStep / totalSteps * 100))
  const rate = job.estimatedSamplerStepMs
  const stepAge = job.lastSamplerStepAt ? Math.max(0, now - job.lastSamplerStepAt) : undefined
  const stageRemaining = Math.max(0, job.totalSteps - job.currentStep)
  const nextStepIn = stageRemaining && rate && stepAge !== undefined ? Math.max(0, rate - stepAge) : undefined
  const stepOverdueBy = stageRemaining && rate && stepAge !== undefined && stepAge > rate * 1.35 ? stepAge - rate : undefined
  const remainingSteps = Math.max(0, totalSteps - currentStep)
  const currentStepElapsed = stageRemaining && rate && stepAge !== undefined ? Math.min(rate, stepAge) : 0
  const remainingMs = rate === undefined ? undefined : job.samplerPass === 'refine'
    ? Math.max(0, stageRemaining * rate - currentStepElapsed)
    : Math.max(0, stageRemaining * rate - currentStepElapsed) + refinementSteps * rate * (job.refinementStepCostMultiplier ?? 1)
  return { progress, currentStep, totalSteps, rate, nextStepIn, stepOverdueBy, remainingSteps, remainingMs, samplerPass: job.samplerPass ?? 'first' }
}
