import type { View } from '../types'

export type MusicEngine = 'acestep' | 'music3'
export type WorkspaceDestination = { view: View; engine?: MusicEngine; label: string; description: string; group: string }

export const workspaceDestinations: WorkspaceDestination[] = [
  { view: 'scratchpad', label: '草稿', description: '生成前先规划场景、打磨提示词。', group: '创作' },
  { view: 'create', label: '视频 · MiniMax H3', description: '由文本、图像或参考素材生成视频。T2V、I2V、Ref2VA。', group: '创作' },
  { view: 'continue', label: '续写视频', description: '用下一个场景或节拍扩展现有视频。', group: '创作' },
  { view: 'ltx25', label: '视频 · LTX 2.5', description: '使用 LTX 引擎生成视频。', group: '创作' },
  { view: 'ltxripple', label: 'LTX 涟漪', description: '首帧全帧：将首帧编辑沿源视频传播。', group: '创作' },
  { view: 'photoedit', label: '照片编辑 · FireRed', description: '用文字指令编辑照片并发送到涟漪。', group: '创作' },
  { view: 'zimage', label: '生成图像', description: '使用 Z-Image 生成静帧图像。', group: '创作' },
  { view: 'music', engine: 'acestep', label: '音乐 · ACE-Step', description: '由歌词与风格创作音乐与人声。', group: '创作' },
  { view: 'music', engine: 'music3', label: '音乐 · Music 3', description: '使用 MiniMax Music 3 生成歌曲。', group: '创作' },
  { view: 'referenceprep', label: '参考准备', description: '为参考素材裁切图像、去除背景。', group: '准备素材' },
  { view: 'characters', label: '角色', description: '构建可复用的角色身份与参考集合。', group: '准备素材' },
  { view: 'hair', label: '发型', description: '为角色创建可复用的发型。', group: '准备素材' },
  { view: 'wardrobes', label: '服装', description: '准备服装与造型参考。', group: '准备素材' },
  { view: 'accessories', label: '配饰', description: '准备道具与配饰。', group: '准备素材' },
  { view: 'locations', label: '地点', description: '构建可复用的场景与环境参考。', group: '准备素材' },
  { view: 'queue', label: '队列', description: '跟踪生成进度、停止任务并查看错误。', group: '审阅与编辑' },
  { view: 'library', label: '视频库', description: '审阅成品视频与参考静帧；收藏画面。', group: '审阅与编辑' },
  { view: 'movie', label: '影片编辑器', description: '在时间线上组装片段与音频。Oyama AI Movie。', group: '审阅与编辑' },
  { view: 'clipmaster', label: '片段主修', description: '裁剪、查看并精修单个片段。', group: '审阅与编辑' },
  { view: 'settings', label: '设置', description: '连接 ComfyUI、配置模型并排查设置问题。', group: '设置' },
]

export function workspaceLabel(view: View, engine: MusicEngine = 'acestep'): string {
  return workspaceDestinations.find(item => item.view === view && (!item.engine || item.engine === engine))?.label ?? view
}

export function findWorkspaces(query: string): WorkspaceDestination[] {
  const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ')
  const terms = normalized.split(' ').filter(Boolean)
  const rank = (item: WorkspaceDestination) => {
    const label = item.label.toLowerCase()
    return label === normalized ? 0 : label.startsWith(normalized) ? 1 : terms.every(term => label.includes(term)) ? 2 : 3
  }
  return workspaceDestinations
    .filter(item => terms.every(term => `${item.label} ${item.description} ${item.group}`.toLowerCase().includes(term)))
    .sort((a, b) => rank(a) - rank(b))
}

export type WorkspaceProjectScope = 'create' | 'ltx25' | 'ltxripple' | 'zimage' | 'music' | 'music3'
export function workspaceProjectScope(view: View, engine: MusicEngine = 'acestep'): WorkspaceProjectScope | null {
  if (view === 'music') return engine === 'music3' ? 'music3' : 'music'
  return view === 'create' || view === 'ltx25' || view === 'ltxripple' || view === 'zimage' ? view : null
}
export function workspaceProjectLabel(scope: WorkspaceProjectScope): string {
  return scope === 'music3' ? '音乐 · Music 3' : workspaceLabel(scope, 'acestep')
}
export function workspaceStorageKey(scope: Exclude<WorkspaceProjectScope, 'create'>): string {
  return { ltx25: 'ltx25.workspace', ltxripple: 'ltx-ripple.workspace.v1', zimage: 'minimax.zimage-workspace', music: 'acestep.workspace', music3: 'minimax.music3-workspace' }[scope]
}
