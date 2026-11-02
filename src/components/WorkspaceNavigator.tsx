import { useRef, useState, type KeyboardEvent } from 'react'
import { ArrowRight, Check, FolderOpen, HelpCircle, Search, RotateCcw } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui'
import { findWorkspaces, workspaceLabel, type MusicEngine } from '../lib/workspaceNavigation'
import type { View } from '../types'
import './workspace-navigator.css'

export function WorkspaceNavigator({ open, onOpenChange, view, engine, onNavigate, onProjects, onTips, onFind, onReset }: {
  open: boolean; onOpenChange(open: boolean): void; view: View; engine: MusicEngine
  onNavigate(view: View, engine?: MusicEngine): void; onProjects(): void; onTips(): void; onFind(): void
  onReset?: () => void
}) {
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const results = findWorkspaces(query)
  const groups = [...new Set(results.map(item => item.group))]
  const run = (action: () => void) => { onOpenChange(false); action() }
  const moveFocus = (event: KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
    const buttons = Array.from(content.current?.querySelectorAll<HTMLButtonElement>('[data-workspace-result]') ?? [])
    if (!buttons.length) return
    event.preventDefault()
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next].focus()
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="workspace-navigator" onOpenAutoFocus={event => { event.preventDefault(); setQuery(''); input.current?.focus() }} onCloseAutoFocus={event => {
      event.preventDefault()
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not(.workspace-navigator)')) return
      Array.from(document.querySelectorAll<HTMLButtonElement>('[data-workspace-trigger]')).find(button => button.getClientRects().length > 0)?.focus()
    }}>
      <header><DialogTitle>工作区</DialogTitle><DialogDescription>选择下一步要用的工具。当前位于 {workspaceLabel(view, engine)}。</DialogDescription></header>
      <label className="workspace-navigator-search"><Search size={18} /><input ref={input} type="search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { moveFocus(event); if (event.key === 'Enter' && results[0]) { event.preventDefault(); run(() => onNavigate(results[0].view, results[0].engine)) } }} placeholder="查找工具或描述任务…" aria-label="搜索工作区" /></label>
      <div className="workspace-navigator-results" ref={content} onKeyDown={moveFocus}>
        {groups.map(group => <section key={group} aria-label={group}><h2>{group}</h2><div>{results.filter(item => item.group === group).map(item => {
          const active = item.view === view && (!item.engine || item.engine === engine)
          return <button type="button" key={`${item.view}-${item.engine ?? ''}`} data-workspace-result aria-current={active ? 'page' : undefined} onClick={() => run(() => onNavigate(item.view, item.engine))}><span><strong>{item.label}</strong><small>{item.description}</small></span>{active ? <Check size={17} aria-label="当前工作区" /> : <ArrowRight size={17} aria-hidden="true" />}</button>
        })}</div></section>)}
        {!results.length && <p role="status">没有匹配的工作区。试试“视频”“音乐”“裁剪”或“设置”。 <button type="button" onClick={() => { setQuery(''); input.current?.focus() }}>清除搜索</button></p>}
      </div>
      <footer><button type="button" onClick={() => run(onProjects)}><FolderOpen size={16} />项目</button><button type="button" onClick={() => run(onTips)}><HelpCircle size={16} />工作区提示</button><button type="button" onClick={() => run(onFind)}><Search size={16} />查找设置</button>{onReset && <button type="button" onClick={() => { if (window.confirm(view === 'create' ? '清除 H3 提示词与已附加的参考素材？渲染设置、已保存项目、媒体文件与队列历史将保留。' : '重置当前工作区？先保存项目以保留其提示词、控件与参考素材。已保存项目与媒体文件会保留。')) run(onReset) }}><RotateCcw size={16} />{view === 'create' ? '清除提示词与素材' : '重置工作区'}</button>}<small>Ctrl/Cmd K：工作区 · Ctrl/Cmd F：设置 · ↑ ↓ 导航 · Enter 打开 · Esc 关闭</small></footer>
    </DialogContent>
  </Dialog>
}
