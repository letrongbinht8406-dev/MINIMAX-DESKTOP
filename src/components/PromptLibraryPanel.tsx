import { useMemo, useState } from 'react'
import { Clock, Star, Trash2 } from 'lucide-react'
import { filterEntries, type PromptLibraryEntry, type PromptLibraryTab } from '../lib/promptLibrary'

interface Props {
  entries: PromptLibraryEntry[]
  onApply: (entry: PromptLibraryEntry) => void
  onToggleFavorite: (id: string) => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
  onClose: () => void
}

/** 相对时间只在 UI 层算，逻辑层保持 ASCII */
function formatWhen(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  return new Date(timestamp).toISOString().slice(0, 10)
}

/**
 * 提示词历史与收藏。
 *
 * 每次成功提交自动进历史（同文本只更新时间），星标进收藏且不受条数上限影响。
 * 点一行就把提示词连同尺寸/步数/seed 一起填回去。
 */
export function PromptLibraryPanel({ entries, onApply, onToggleFavorite, onRename, onRemove, onClose }: Props) {
  const [tab, setTab] = useState<PromptLibraryTab>('history')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  const list = useMemo(() => filterEntries(entries, tab, query), [entries, tab, query])
  const favoriteCount = entries.filter((entry) => entry.favorite).length

  return <div className="prompt-library">
    <div className="prompt-library-head">
      <div className="prompt-library-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>历史 ({entries.length})</button>
        <button type="button" role="tab" aria-selected={tab === 'favorites'} className={tab === 'favorites' ? 'active' : ''} onClick={() => setTab('favorites')}>收藏 ({favoriteCount})</button>
      </div>
      <button type="button" className="prompt-library-close" onClick={onClose} title="收起提示词库">收起</button>
    </div>

    <input
      className="prompt-library-search"
      value={query}
      placeholder="搜索提示词、负面词或名字…"
      onChange={(event) => setQuery(event.target.value)}
    />

    {list.length === 0
      ? <p className="prompt-library-empty">
        {entries.length === 0
          ? '还没有记录。提交一次生成后，提示词会自动留在这里。'
          : tab === 'favorites'
            ? '还没有收藏。点条目上的 ☆ 收进来。'
            : '没有匹配的提示词。'}
      </p>
      : <ul className="prompt-library-list">
        {list.map((entry) => <li key={entry.id} className={entry.favorite ? 'favorite' : ''}>
          <div className="prompt-library-row">
            <button type="button" className="prompt-library-main" onClick={() => onApply(entry)} title="填入提示词与参数">
              {editing === entry.id
                ? <input
                  autoFocus
                  className="prompt-library-rename"
                  value={draftName}
                  placeholder="给这条收藏起个名字"
                  onChange={(event) => setDraftName(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onBlur={() => { onRename(entry.id, draftName); setEditing(null) }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') { onRename(entry.id, draftName); setEditing(null) }
                    if (event.key === 'Escape') setEditing(null)
                  }}
                />
                : <>
                  {entry.name && <strong className="prompt-library-name">{entry.name}</strong>}
                  <span className="prompt-library-text">{entry.text}</span>
                </>}
            </button>
            <div className="prompt-library-meta">
              <span className="prompt-library-when"><Clock size={11} />{formatWhen(entry.createdAt)}</span>
              <button type="button" className={entry.favorite ? 'starred' : ''} onClick={() => onToggleFavorite(entry.id)} title={entry.favorite ? '取消收藏' : '收藏'}><Star size={13} fill={entry.favorite ? 'currentColor' : 'none'} /></button>
              <button type="button" onClick={() => { setEditing(entry.id); setDraftName(entry.name ?? '') }} title="重命名">改名</button>
              <button type="button" onClick={() => onRemove(entry.id)} title="删除"><Trash2 size={13} /></button>
            </div>
          </div>
          <div className="prompt-library-params">
            <span>{entry.options.resolution ?? '默认尺寸'}</span>
            <span>{entry.options.steps ?? '—'} 步</span>
            <span>CFG {entry.options.guidance ?? '—'}</span>
            <span>seed {entry.options.seed ?? '—'}</span>
            <span>{entry.providerId}</span>
          </div>
        </li>)}
      </ul>}
  </div>
}
