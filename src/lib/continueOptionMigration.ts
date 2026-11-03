// P0-2：汉化首轮窗口期内，ContinueWorkspace 的镜头设计选项值可能已按中文存入
// localStorage（旧存档）。加载路径统一归一化：中文值 -> 标准英文枚举；
// 映射不到的中文值回退为 '继承/自动'（空串），英文/未知值原样保留（前向兼容）。
export const CONTINUE_OPTION_FIELDS = ['shotSize', 'cameraAngle', 'cameraMovement'] as const
export type ContinueOptionField = (typeof CONTINUE_OPTION_FIELDS)[number]

// 与 ContinueWorkspace 下拉选项一一对应（option value 必须保持英文：喂给生成管线）
export const CONTINUE_OPTION_MIGRATION: Record<ContinueOptionField, Record<string, string>> = {
  shotSize: { '全景': 'wide shot', '中景': 'medium shot', '特写': 'close-up', '大特写': 'extreme close-up' },
  cameraAngle: { '平视': 'eye-level angle', '仰角': 'low angle', '俯角': 'high angle', '过肩': 'over-the-shoulder angle' },
  cameraMovement: { '固定': 'locked-off camera', '摇镜': 'slow pan', '跟拍': 'tracking shot', '手持': 'handheld camera' },
}

export function migrateContinueOptionValue(field: ContinueOptionField, rawValue: unknown): string {
  if (typeof rawValue !== 'string' || rawValue === '') return ''
  const mapped = CONTINUE_OPTION_MIGRATION[field][rawValue]
  if (mapped) return mapped
  if (/[一-鿿]/.test(rawValue)) return ''
  return rawValue
}

export type MigratableContinueBeat = { shotSize?: string; cameraAngle?: string; cameraMovement?: string }

export function migrateContinueBeatOptions<T extends MigratableContinueBeat>(beat: T): T {
  const migrated: MigratableContinueBeat = {
    shotSize: migrateContinueOptionValue('shotSize', beat.shotSize),
    cameraAngle: migrateContinueOptionValue('cameraAngle', beat.cameraAngle),
    cameraMovement: migrateContinueOptionValue('cameraMovement', beat.cameraMovement),
  }
  const next = { ...beat }
  for (const field of CONTINUE_OPTION_FIELDS) {
    if (migrated[field] === '') delete next[field]
    else next[field] = migrated[field]
  }
  return next
}
