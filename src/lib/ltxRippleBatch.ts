import { rippleFramesForSeconds } from './ltxRippleWorkflow'

export type RippleChunk = { index: number; startFrame: number; sourceFrames: number; outputFrames: number; overlapFrames: number }

export function planRippleChunks(duration: number, chunkSeconds: number, overlapSeconds: number): RippleChunk[] {
  if (!Number.isFinite(duration) || duration < 2 || duration > 300) throw new Error('长 Ripple 模式支持 2 秒到 5 分钟的源片段。')
  const outputFrames = rippleFramesForSeconds(chunkSeconds)
  const chunkSourceFrames = outputFrames - 1
  const overlapFrames = Math.round(overlapSeconds * 24)
  if (!Number.isFinite(overlapSeconds) || overlapFrames < 0 || overlapFrames > 48 || overlapFrames >= chunkSourceFrames / 2) throw new Error('选择 0 到 2 秒之间的重叠时长，需短于半个片段。')
  const totalSourceFrames = Math.ceil(Math.round(duration * 24) / 8) * 8
  const chunks: RippleChunk[] = []
  let startFrame = 0
  while (startFrame < totalSourceFrames) {
    const remaining = totalSourceFrames - startFrame
    // Pad a short tail so it satisfies LTX's 8n + 1 rule and remains longer
    // than twice the overlap required by the transition assembler.
    const sourceFrames = Math.min(chunkSourceFrames, Math.max(48, overlapFrames * 2 + 8, Math.ceil(remaining / 8) * 8))
    chunks.push({ index: chunks.length, startFrame, sourceFrames, outputFrames: sourceFrames + 1, overlapFrames: chunks.length ? overlapFrames : 0 })
    if (startFrame + sourceFrames >= totalSourceFrames) break
    startFrame += sourceFrames - overlapFrames
    if (chunks.length > 100) throw new Error('此片段需要过多的 Ripple 片段，请增加片段长度。')
  }
  return chunks
}
