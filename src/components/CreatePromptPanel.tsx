import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Check, Clock3, Hash, Maximize2, Search, WandSparkles, X } from 'lucide-react'
import { H3PromptEditor, type H3PromptEditorHandle, type ProductionCommandTrigger } from './H3PromptEditor'
import { VideoPromptModal } from './VideoPromptModal'
import { findPromptCommands, promptPresetCategories } from '../lib/promptPresets'
import { autoTagPrompt } from '../lib/promptAutoTags'
import { normalizeInlineSuggestion } from '../lib/inlineSuggestion'
import { promptMarkupLegend } from '../lib/h3SceneCompiler'
import type { AppSettings, PromptPresetCategory } from '../types'

interface CreatePromptPanelProps {
  prompt: string
  setPrompt(value: string): void
  onPromptTool(tool: 'enhance' | 'timeline' | 'audio'): void
  promptingTool: 'enhance' | 'timeline' | 'audio' | null
  promptAiProgress: { thinking: string; content: string } | null
  promptSuggestion: string
  onUseSuggestion(): void
  onDismissSuggestion(): void
  provider: AppSettings['llmProvider']
  providerLabel: string
  model: string
  url: string
  suggestionsEnabled: boolean
  modelAvailable: boolean
}

export function CreatePromptPanel({ prompt, setPrompt, onPromptTool, promptingTool, promptAiProgress, promptSuggestion, onUseSuggestion, onDismissSuggestion, provider, providerLabel, model, url, suggestionsEnabled, modelAvailable }: CreatePromptPanelProps) {
  const editor = useRef<H3PromptEditorHandle>(null)
  const search = useRef<HTMLInputElement>(null)
  const edited = useRef(false)
  const requestVersion = useRef(0)
  const pending = useRef(false)
  const [expanded, setExpanded] = useState(false)
  const [tagHelpOpen, setTagHelpOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [trigger, setTrigger] = useState<ProductionCommandTrigger | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | PromptPresetCategory>('all')
  const [active, setActive] = useState(0)
  const [completion, setCompletion] = useState('')
  const [completionError, setCompletionError] = useState('')
  const [tagMessage, setTagMessage] = useState('')
  const [retry, setRetry] = useState(0)
  const results = useMemo(() => findPromptCommands(query, category), [category, query])

  useEffect(() => () => { requestVersion.current += 1 }, [])
  useEffect(() => setActive(0), [category, query])
  useEffect(() => {
    requestVersion.current += 1
    setCompletion('')
    if (!suggestionsEnabled || !modelAvailable || !model || !edited.current || trigger || !prompt.trim() || prompt.trim().length < 35 || prompt.length > 5000 || pending.current) return
    const version = requestVersion.current
    const timer = window.setTimeout(() => {
      pending.current = true
      setCompletionError('')
      void window.minimax.generatePromptCompletion(url, model, prompt, provider)
        .then(answer => {
          if (version !== requestVersion.current) return
          const cleaned = normalizeInlineSuggestion(answer)
          if (cleaned && !prompt.endsWith(cleaned) && !/^##|^\/\//.test(cleaned)) setCompletion(cleaned)
        })
        .catch(error => { if (version === requestVersion.current) setCompletionError(error instanceof Error ? error.message : String(error)) })
        .finally(() => { pending.current = false; if (version !== requestVersion.current) setRetry(current => current + 1) })
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [prompt, suggestionsEnabled, modelAvailable, model, provider, url, trigger, retry])

  const updatePrompt = (value: string) => { edited.current = true; setPrompt(value); setTagMessage(''); setCompletionError('') }
  const updateTrigger = (next: ProductionCommandTrigger | null) => {
    setTrigger(next)
    if (next) { setMenuOpen(true); setQuery(next.query); setCategory('all') }
    else if (trigger) setMenuOpen(false)
  }
  const insertCommand = (index: number) => {
    const item = results[index]
    if (!item) return
    editor.current?.insertText(item.insertion, trigger ? { start: trigger.start, end: trigger.end } : undefined)
    setMenuOpen(false); setTrigger(null); setQuery('')
  }
  const commandKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!menuOpen) return false
    if (event.key === 'ArrowDown' && results.length) { event.preventDefault(); setActive(index => (index + 1) % results.length); return true }
    if (event.key === 'ArrowUp' && results.length) { event.preventDefault(); setActive(index => (index - 1 + results.length) % results.length); return true }
    if ((event.key === 'Enter' || event.key === 'Tab') && results[active]) { event.preventDefault(); insertCommand(active); return true }
    if (event.key === 'Escape') { event.preventDefault(); setMenuOpen(false); setTrigger(null); return true }
    return false
  }
  const openCommands = () => { setMenuOpen(true); setTrigger(null); setQuery(''); window.requestAnimationFrame(() => search.current?.focus()) }
  const acceptCompletion = (range: { start: number; end: number }) => {
    if (!completion) return
    editor.current?.insertText(completion, range)
    setCompletion('')
  }
  const applyTags = () => {
    const next = autoTagPrompt(prompt)
    if (next === prompt) { setTagMessage(prompt.trim() ? '已保留现有 H3 标签。' : '先写一个场景。'); return }
    updatePrompt(next)
    setTagMessage('已把场景、声音、音乐标签整理进 H3 分段，渲染前请复核。')
  }

  return <section className="video-prompt-panel create-prompt-panel" aria-label="创建提示词">
    <header className="create-prompt-heading"><span><strong>场景指引</strong><small>自然书写，再用本地工具修整镜头。</small></span><button type="button" className="video-prompt-expand" onClick={() => setExpanded(true)}><Maximize2 size={14} />聚焦编辑器</button></header>
    <div className="create-prompt-toolbar" aria-label="提示词工具">
      <button type="button" onClick={openCommands} aria-expanded={menuOpen} aria-controls="create-production-commands"><Search size={14} /><span><code>//</code> 指令</span></button>
      <button type="button" onClick={applyTags} disabled={!prompt.trim()}><Hash size={14} />自动打标</button>
      <button type="button" onClick={() => setTagHelpOpen(true)}><Hash size={14} />H3 标签</button>
      <span className="create-prompt-tool-separator" />
      <button type="button" onClick={() => onPromptTool('enhance')} disabled={!modelAvailable || !prompt.trim() || Boolean(promptingTool)}>{promptingTool === 'enhance' ? <span className="spin">◌</span> : <WandSparkles size={14} />}增强</button>
      <button type="button" onClick={() => onPromptTool('timeline')} disabled={!modelAvailable || !prompt.trim() || Boolean(promptingTool)}><Clock3 size={14} />时间线</button>
      <span className="create-prompt-provider">{modelAvailable ? `${providerLabel} · ${model}` : `${providerLabel} 未连接`}</span>
    </div>
    <H3PromptEditor ref={editor} idPrefix="create-prompt" value={prompt} onChange={updatePrompt} placeholder="描述场景。输入 // 调出生产指令，或输入 ## 插入 H3 分段…" productionMenu={menuOpen ? { id: 'create-production-results', activeId: results[active] ? `create-production-command-${active}` : undefined } : undefined} onProductionCommandChange={updateTrigger} onProductionCommandKeyDown={commandKeyDown} completion={suggestionsEnabled && !menuOpen ? completion : ''} onAcceptCompletion={acceptCompletion} />
    {menuOpen && <section id="create-production-commands" className="create-production-menu" aria-label="制作命令">
      <header><span><strong>生产指令</strong><small>{trigger ? '继续输入以筛选 · 回车插入' : '搜索并在光标处插入'}</small></span><button type="button" onClick={() => { setMenuOpen(false); setTrigger(null); editor.current?.focus() }} aria-label="关闭制作命令"><X size={15} /></button></header>
      <label className="create-production-search"><Search size={14} /><input ref={search} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setMenuOpen(false); editor.current?.focus() } else if (event.key === 'Enter') { event.preventDefault(); insertCommand(active) } }} placeholder="机位、镜头、灯光、声音…" aria-label="搜索制作命令" /></label>
      <div className="create-production-categories" role="group" aria-label="制作命令分类"><button type="button" className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>全部</button>{promptPresetCategories.map(item => <button type="button" key={item.id} className={category === item.id ? 'active' : ''} onClick={() => setCategory(item.id)}>{item.label}</button>)}</div>
      <div id="create-production-results" className="create-production-results" role="listbox" aria-label="匹配的制作命令">{results.map((item, index) => <button type="button" id={`create-production-command-${index}`} role="option" aria-selected={active === index} className={active === index ? 'active' : ''} key={item.id} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => insertCommand(index)}><span><strong>{item.label}</strong><em>{item.category}</em></span><small>{item.description}</small></button>)}{!results.length && <p>没有匹配的指令，换个词或分类试试。</p>}</div>
      <footer>↑↓ 浏览 · 回车插入 · Esc 关闭</footer>
    </section>}
    <footer className="create-prompt-meta"><span><code>##</code> H3 分段 · <code>//</code> 生产指令</span><span>{prompt.length.toLocaleString()} 字符</span></footer>
    {tagMessage && <p className="create-prompt-note" role="status">{tagMessage}</p>}
    {suggestionsEnabled && completionError && <p className="create-prompt-note error" role="status">{providerLabel} 建议不可用：{completionError}</p>}
    {promptAiProgress && <section className="create-prompt-thinking" aria-label="本地 AI 进度"><header><strong>{promptingTool ? `${providerLabel} 处理中…` : `${providerLabel} 已完成`}</strong><small role="status" aria-live="polite">{!promptingTool ? '待复核' : promptAiProgress.content ? '已收到草稿' : promptAiProgress.thinking ? '思考中' : '等待模型'}</small></header><details open={Boolean(promptingTool)}><summary>模型思考</summary><pre>{promptAiProgress.thinking ? promptAiProgress.thinking.slice(-4000) : '该模型未返回推理文本。'}</pre></details></section>}
    {promptSuggestion && <div className="video-prompt-suggestion" role="status"><p>{promptSuggestion}</p><button type="button" onClick={onDismissSuggestion}>忽略</button><button type="button" onClick={onUseSuggestion}><Check size={13} />采用建议</button></div>}
    {expanded && <VideoPromptModal value={prompt} promptingTool={promptingTool} onChange={updatePrompt} onPromptTool={onPromptTool} onClose={() => setExpanded(false)} />}
    {tagHelpOpen && <div className="video-syntax-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setTagHelpOpen(false) }}><section className="video-syntax-dialog" role="dialog" aria-modal="true" aria-labelledby="create-syntax-title"><header><span><strong id="create-syntax-title">H3 提示词分段</strong><small>在提示词中输入 ##，或在此处插入分段。</small></span><button type="button" onClick={() => setTagHelpOpen(false)} aria-label="关闭 H3 标签帮助"><X size={17} /></button></header><div className="video-syntax-list">{promptMarkupLegend.map(item => <div key={item.tag}><code>{item.tag}</code><span>{item.description}</span><button type="button" onClick={() => { updatePrompt(`${prompt}${prompt.trim() ? '\n\n' : ''}${item.tag}\n`); setTagHelpOpen(false); editor.current?.focus() }}>插入</button></div>)}</div><footer><span>分段用于引导 H3 编译器，你原来的措辞仍可编辑。</span><button type="button" onClick={() => setTagHelpOpen(false)}>完成</button></footer></section></div>}
  </section>
}
