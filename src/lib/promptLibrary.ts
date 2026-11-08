/**
 * 提示词库：图像提示词的历史与收藏。
 *
 * 为什么不能直接复用任务队列：任务只留最近若干条，且混着失败与取消；提示词是长期资产。
 * 只存文本的话，复用时尺寸/步数/seed 全丢，等于白存 —— 这里连可复现的关键参数一起快照。
 *
 * 策略：
 *  - 每次成功提交自动进历史；同文本（同 provider）只把时间顶到最新，不重复堆
 *  - 收藏永不因条数上限被清掉
 *  - 参考图不存（文件可能已被清掉）
 *
 * 本模块只放纯逻辑与存储，运行时字符串保持 ASCII；中文文案在 UI 层。
 */

export type PromptLibraryTab = 'history' | 'favorites'

/** 可复现一次生成的关键参数快照 */
export interface PromptLibraryOptions {
  resolution: string
  providerId: string
  variant: string
  sampler: string
  scheduler: string
  seed: number
  steps: number
  guidance: number
}

export interface PromptLibraryEntry {
  id: string
  text: string
  negative?: string
  providerId: string
  options: Partial<PromptLibraryOptions>
  createdAt: number
  favorite: boolean
  /** 收藏时起的名字 */
  name?: string
}

export interface PromptLibraryDraft {
  text: string
  negative?: string
  providerId: string
  options: PromptLibraryOptions
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export const PROMPT_LIBRARY_KEY = 'minimax.prompt-library.v1'
/** 非收藏项的保留上限；收藏不受限 */
export const PROMPT_LIBRARY_LIMIT = 100

function storageOf(candidate?: StorageLike): StorageLike | undefined {
  if (candidate) return candidate
  return typeof localStorage === 'undefined' ? undefined : localStorage
}

function isEntry(value: unknown): value is PromptLibraryEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<PromptLibraryEntry>
  return typeof entry.id === 'string' && typeof entry.text === 'string' && typeof entry.createdAt === 'number'
}

function newId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function snapshot(options: PromptLibraryOptions): PromptLibraryOptions {
  return {
    resolution: options.resolution,
    providerId: options.providerId,
    variant: options.variant,
    sampler: options.sampler,
    scheduler: options.scheduler,
    seed: options.seed,
    steps: options.steps,
    guidance: options.guidance,
  }
}

/** 容错读：坏数据当空库，不要把界面带崩 */
export function loadPromptLibrary(storage?: StorageLike): PromptLibraryEntry[] {
  const target = storageOf(storage)
  if (!target) return []
  try {
    const raw = target.getItem(PROMPT_LIBRARY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { version?: number; entries?: unknown }
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : []
    return entries.filter(isEntry).map((entry) => ({ ...entry, favorite: Boolean(entry.favorite) }))
  } catch {
    return []
  }
}

export function savePromptLibrary(entries: PromptLibraryEntry[], storage?: StorageLike): boolean {
  const target = storageOf(storage)
  if (!target) return false
  try {
    target.setItem(PROMPT_LIBRARY_KEY, JSON.stringify({ version: 1, entries }))
    return true
  } catch {
    // 配额满或隐私模式：丢历史可以接受，崩不行
    return false
  }
}

/** 裁掉超出上限的**非收藏**项，收藏永远保留 */
export function capHistory(entries: PromptLibraryEntry[], limit = PROMPT_LIBRARY_LIMIT): PromptLibraryEntry[] {
  const favorites = entries.filter((entry) => entry.favorite)
  const rest = entries.filter((entry) => !entry.favorite).sort((left, right) => right.createdAt - left.createdAt)
  const kept = rest.slice(0, Math.max(0, limit - favorites.length))
  return [...favorites, ...kept].sort((left, right) => right.createdAt - left.createdAt)
}

/** 文本完全相同的（同 provider）只更新时间与参数，不新增条目 */
export function rememberPrompt(
  entries: PromptLibraryEntry[],
  draft: PromptLibraryDraft,
  now = Date.now(),
): PromptLibraryEntry[] {
  const text = draft.text.trim()
  if (!text) return entries
  const negative = draft.negative?.trim() || undefined
  const next = [...entries]
  const existing = next.find(
    (entry) => entry.text === text && entry.providerId === draft.providerId,
  )
  if (existing) {
    next[next.indexOf(existing)] = { ...existing, createdAt: now, options: snapshot(draft.options), negative }
    return capHistory(next)
  }
  next.push({
    id: newId(),
    text,
    negative,
    providerId: draft.providerId,
    options: snapshot(draft.options),
    createdAt: now,
    favorite: false,
  })
  return capHistory(next)
}

export function toggleFavorite(entries: PromptLibraryEntry[], id: string): PromptLibraryEntry[] {
  return entries.map((entry) => (entry.id === id ? { ...entry, favorite: !entry.favorite } : entry))
}

export function renameEntry(entries: PromptLibraryEntry[], id: string, name: string): PromptLibraryEntry[] {
  return entries.map((entry) => (entry.id === id ? { ...entry, name: name.trim() || undefined } : entry))
}

export function removeEntry(entries: PromptLibraryEntry[], id: string): PromptLibraryEntry[] {
  return entries.filter((entry) => entry.id !== id)
}

/** 搜索：文本、负向、名字三处一起匹配 */
export function searchEntries(entries: PromptLibraryEntry[], query: string): PromptLibraryEntry[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return entries
  return entries.filter((entry) =>
    [entry.text, entry.negative ?? '', entry.name ?? ''].some((field) => field.toLowerCase().includes(needle)),
  )
}

export function filterEntries(
  entries: PromptLibraryEntry[],
  tab: PromptLibraryTab,
  query: string,
): PromptLibraryEntry[] {
  const scoped = tab === 'favorites' ? entries.filter((entry) => entry.favorite) : entries
  return searchEntries(scoped, query)
}
