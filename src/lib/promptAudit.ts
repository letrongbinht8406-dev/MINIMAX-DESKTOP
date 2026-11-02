import type { GenerationMode, MovieReferenceBinding } from '../types'

export type PromptAudit = { errors: string[]; warnings: string[]; suggestions: string[] }

const referenceToken = /<(Picture|Video|Audio)\s+(\d+)>/gi

export function auditH3Prompt(prompt: string, input: { mode: GenerationMode; duration: number; bindings?: MovieReferenceBinding[]; imageCount?: number; videoCount?: number; audioCount?: number; noDialogue?: boolean }): PromptAudit {
  const errors: string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []
  const text = prompt.trim()
  if (!text) errors.push('渲染前请先添加镜头方向。')
  if (text.length > 12000) errors.push('提示词过长，无法可靠地单次渲染。请将动作拆分为更小的镜头。')
  const cameras = (text.match(/\b(?:camera|lens|shot|camera angle)\s*:/gi) ?? []).length
  if (cameras > 5) warnings.push('一个镜头中存在多个相互冲突的摄影机指令。请保留一个主要运镜和一个构图决定。')
  if (/\b(?:then|after that|next)\b/gi.test(text) && input.duration <= 5) warnings.push('此短渲染包含多个连续节拍。请将其精简为一个明确动作和一个镜头运动。')
  if (input.noDialogue && /(?:<d>|\b(?:says|dialogue|speaks|whispers|narrat))/i.test(text)) errors.push('已启用"无对白"，但导演说明中包含对白或台词。请移除相关内容或关闭"无对白"选项。')
  const counts = { Picture: input.imageCount ?? input.bindings?.length ?? 0, Video: input.videoCount ?? 0, Audio: input.audioCount ?? 0 }
  const used = new Set<string>()
  for (const match of text.matchAll(referenceToken)) {
    const kind = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase() as keyof typeof counts
    const index = Number(match[2])
    used.add(`${kind}:${index}`)
    if (index < 1 || index > counts[kind]) errors.push(`<${kind} ${index}> does not match an attached ${kind.toLowerCase()} reference.`)
  }
  if (input.mode === 'reference' && counts.Picture + counts.Video + counts.Audio === 0) errors.push('参考模式至少需要一个图像或视频参考。')
  if (input.mode === 'reference' && counts.Audio && !counts.Picture && !counts.Video) errors.push('音频参考至少需要一个视觉参考。')
  if (input.mode === 'reference' && counts.Picture && ![...used].some((item) => item.startsWith('图片：'))) suggestions.push('请在导演说明中为每张图片参考命名，以明确其用途。')
  if (input.mode === 'image') suggestions.push('Treat the first frame as the exact opening composition; describe only the motion that follows it.')
  if (input.mode === 'frames') suggestions.push('请描述开场帧与结尾帧之间一个物理上连续的过渡。')
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], suggestions: [...new Set(suggestions)] }
}

export function auditCopilotReferences(text: string, referenceMap: string[] = []) {
  const available = new Map<string, number>()
  referenceMap.forEach((entry) => {
    const source = entry.match(/<((?:Picture|Video|Audio)\s+\d+)>/i)?.[1]
    if (!source) return
    const [kind, number] = source.split(/\s+/)
    available.set(kind.toLowerCase(), Math.max(available.get(kind.toLowerCase()) ?? 0, Number(number)))
  })
  const invalid: string[] = []
  for (const match of text.matchAll(referenceToken)) {
    const kind = match[1].toLowerCase()
    if (Number(match[2]) > (available.get(kind) ?? 0)) invalid.push(match[0])
  }
  return [...new Set(invalid)]
}
