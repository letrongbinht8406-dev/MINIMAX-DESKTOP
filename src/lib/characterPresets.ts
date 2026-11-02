export const characterAppearancePresets = [
  ['custom', '自定义外观', ''],
  ['hero', 'Cinematic lead', 'Adult cinematic lead with balanced facial proportions, expressive eyes, a clear silhouette, natural skin texture, and a fit believable build.'],
  ['character-actor', '性格演员', 'Adult character actor with memorable facial geometry, expressive asymmetry, lived-in skin detail, and a distinctive but believable silhouette.'],
  ['editorial', '时尚模特', 'Adult editorial model with sculptural facial planes, long clean lines, controlled posture, and camera-ready natural skin texture.'],
  ['everyday', '自然日常', 'Adult with approachable everyday features, realistic proportions, subtle facial asymmetry, natural skin texture, and an unforced posture.'],
  ['athletic', '运动型演员', 'Adult athletic performer with functional muscle definition, balanced proportions, grounded posture, and a physically capable silhouette.'],
  ['mature', '成熟戏剧型', 'Mature adult with age-authentic facial structure, fine lines, textured skin, confident posture, and strong dramatic presence.'],
  ['comedian', '表现力喜剧型', 'Adult comedy performer with highly readable eyes and brows, flexible facial expression, approachable proportions, and energetic body language.'],
  ['action', '动作主角', 'Adult action protagonist with a resilient athletic build, focused eyes, defined facial planes, grounded balance, and a strong readable silhouette.'],
  ['period', 'Period drama', 'Adult period-drama performer with classically composed facial proportions, restrained posture, natural skin texture, and timeless screen presence.'],
] as const

export const characterVisualStylePresets = [
  'cinematic photorealism',
  'naturalistic 35mm film',
  'large-format cinematic realism',
  '高端电视写实',
  '纪录片自然主义',
  '时尚杂志摄影',
  '商业美妆摄影',
  '新黑色电影写实',
  '温暖浪漫剧情',
  '粗粝独立电影',
  '复古70年代电影写实',
  '高调棚拍写实',
  '风格化图形写实',
  '高端3D动画',
  '手绘绘本动画',
  '动漫风格电影插画',
] as const

export const characterVoicePresets = [
  ['custom', '自定义声音', ''],
  ['warm-grounded', '温暖沉稳', 'Warm grounded speaking voice, medium-low register, measured pace, clear diction, subtle breath, and emotionally honest delivery.'],
  ['bright-quick', '明亮轻快', '明亮灵活的声音，中音域，轻快的对话节奏，清晰的咬字，俏皮的节奏感，以及富有响应力的活力。'],
  ['quiet-intense', '安静的张力', '安静克制的声音，低音量，从容的节奏，精准的咬字，内敛的情感，以及强烈的潜台词。'],
  ['authoritative', '沉稳权威', '沉稳权威的声音，稳定的低音域，不疾不徐的节奏，简洁的措辞，以及无需提高音量便具有的从容气场。'],
  ['vulnerable', '亲密而脆弱', 'Intimate close-mic voice, soft register, natural pauses, audible thought, delicate breath, and emotionally vulnerable restraint.'],
  ['comic', '表现力强的喜剧', 'Expressive conversational voice, elastic pacing, readable reactions, clean comic timing, and spontaneous but controlled energy.'],
  ['documentary', '自然纪录片风格', 'Unpolished natural voice, conversational pace, regional character preserved, small hesitations, and authentic non-performative delivery.'],
  ['elegant', '优雅精准', '优雅沉稳的嗓音，清晰的共鸣，精准的咬字，克制的节奏，以及内敛的情感表达。'],
  ['weathered', '沧桑质感', 'Weathered textured voice, lower register, economical phrasing, rough warmth, deliberate pauses, and lived-in emotional weight.'],
] as const

export const characterPerformancePresets = [
  ['custom', '自定义表演', ''],
  ['natural', 'Naturalistic', 'Performance baseline: naturalistic, grounded, minimal gestures, responsive eye focus, and emotion carried through small facial changes.'],
  ['restrained', '克制的戏剧感', 'Performance baseline: restrained dramatic presence, still posture, deliberate movement, held eye contact, and layered subtext.'],
  ['energetic', 'Energetic', 'Performance baseline: energetic and physically expressive, quick reactions, open posture, clear gesture shapes, and lively timing.'],
  ['deadpan', 'Deadpan', 'Performance baseline: dry deadpan delivery, economical movement, steady gaze, minimal facial reaction, and precise comic timing.'],
  ['charismatic', '魅力主角', 'Performance baseline: confident charismatic presence, relaxed posture, direct eye focus, controlled gestures, and easy emotional access.'],
  ['nervous', '紧张不安', 'Performance baseline: contained nervous energy, guarded posture, darting eye focus, small self-soothing gestures, and interrupted breath.'],
  ['physical', '肢体表演者', 'Performance baseline: body-led acting, clear weight shifts, readable silhouette, precise spatial awareness, and controlled physical storytelling.'],
  ['voiceover', '以声为主', 'Performance baseline: voice-forward acting with disciplined breath, precise phrasing, controlled facial movement, and restrained body language.'],
] as const

export function appendPreset(current: string, addition: string) {
  if (!addition || current.toLowerCase().includes(addition.toLowerCase())) return current
  return [current.trim().replace(/[.\s]+$/, ''), addition].filter(Boolean).join('. ')
}
