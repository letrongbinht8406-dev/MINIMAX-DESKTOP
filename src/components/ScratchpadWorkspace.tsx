import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Clipboard, Clock3, Copy, Eraser, FileText, LoaderCircle, MessageSquareText, RefreshCw, RotateCcw, Sparkles, WandSparkles } from 'lucide-react'
import { promptMarkupLegend } from '../lib/h3SceneCompiler'
import { compileScratchpad, type ScratchpadTarget } from '../lib/scratchpadCompiler'
import { normalizeInlineSuggestion } from '../lib/inlineSuggestion'
import type { OllamaModel } from '../types'
import { H3PromptEditor, type H3PromptEditorHandle } from './H3PromptEditor'

const STORAGE_KEY = 'oyama.prompt-scratchpad.v1'
const targets: Array<{ id: ScratchpadTarget; label: string; note: string }> = [
  { id: 'h3', label: 'MiniMax H3', note: '官方多模态字段' },
  { id: 'ltx25', label: 'LTX 2.5', note: '自然视频方向' },
  { id: 'image', label: '创建图像', note: '静态图像方向' },
  { id: 'music', label: 'Music', note: '配乐与制作方向' },
]

function loadDraft() {
  try { return localStorage.getItem(STORAGE_KEY) ?? '' } catch { return '' }
}

const toolInstructions = {
  refine: 'Rewrite this as a polished, production-ready prompt. Preserve every intentional fact, remove repetition, and return only the revised prompt.',
  expand: 'Expand this prompt with concrete subject action, composition, camera, environment, lighting, physical continuity, and sound where appropriate. Do not change its intent. Return only the revised prompt.',
  concise: 'Condense this prompt without losing identity, continuity, camera, action, lighting, or audio constraints. Return only the revised prompt.',
  structure: `Convert this prompt into the canonical authoring sections ${promptMarkupLegend.map(item => item.tag).join(', ')}. Use only relevant sections, place each tag on its own line, and return only the tagged prompt.`,
  timeline: 'Rewrite this as an achievable timed shot plan for a short generated video. Keep actions physically coherent and cuts readable. Return only the revised prompt.',
  audio: 'Improve only dialogue, ambience, foley, synchronization, and non-diegetic music direction. Preserve the visual intent. Return the complete revised prompt only.',
} as const

export function ScratchpadWorkspace({ provider, url, model, models, available, checking, connectionError, onRefresh, onModelChange, onSend, onNotice }: { provider: 'ollama' | 'lmstudio' | 'llama'; url: string; model: string; models: OllamaModel[]; available: boolean; checking: boolean; connectionError?: string; onRefresh(): void; onModelChange(model: string): void; onSend(target: ScratchpadTarget, authored: string, compiled: string): void; onNotice(tone: 'error' | 'success' | 'neutral', text: string): void }) {
  const [draft, setDraft] = useState(loadDraft)
  const [target, setTarget] = useState<ScratchpadTarget>('h3')
  const [duration, setDuration] = useState(5)
  const [busy, setBusy] = useState<keyof typeof toolInstructions | null>(null)
  const [aiProgress, setAiProgress] = useState<{ thinking: string; content: string } | null>(null)
  const [completionEnabled, setCompletionEnabled] = useState(true)
  const [completion, setCompletion] = useState('')
  const [completionStatus, setCompletionStatus] = useState<'idle' | 'waiting' | 'working' | 'error'>('idle')
  const [completionError, setCompletionError] = useState('')
  const [beforeAi, setBeforeAi] = useState('')
  const [copied, setCopied] = useState(false)
  const completionRevision = useRef(0)
  const editor = useRef<H3PromptEditorHandle>(null)
  const compiled = useMemo(() => compileScratchpad(draft, target, duration), [draft, duration, target])
  const selectedModel = models.some(item => item.name === model) ? model : models[0]?.name ?? ''
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, draft) } catch { /* Draft remains available for this session. */ } }, [draft])
  useEffect(() => {
    setCompletion('')
    setCompletionError('')
    if (!completionEnabled || !available || !selectedModel || draft.trim().length < 32 || busy) { setCompletionStatus('idle'); return }
    setCompletionStatus('waiting')
    const revision = ++completionRevision.current
    const timer = window.setTimeout(async () => {
      setCompletionStatus('working')
      try {
        const result = await window.minimax.generatePromptCompletion(url, selectedModel, draft, provider)
        if (completionRevision.current === revision) { setCompletion(normalizeInlineSuggestion(result)); setCompletionStatus('idle') }
      } catch (error) {
        if (completionRevision.current === revision) { setCompletion(''); setCompletionStatus('error'); setCompletionError(error instanceof Error ? error.message : String(error)) }
      }
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [available, busy, completionEnabled, draft, provider, selectedModel, url])

  const runTool = async (tool: keyof typeof toolInstructions) => {
    if (!draft.trim() || !available || busy) return
    setBusy(tool); setCompletion(''); setAiProgress({ thinking: '', content: '' })
    try {
      const result = await window.minimax.generateWithOllama(url, selectedModel, `${toolInstructions[tool]}\n\nTarget: ${targets.find(item => item.id === target)?.label}\nDuration: ${duration} seconds\n\nSOURCE PROMPT\n${draft}`, provider, setAiProgress)
      setBeforeAi(draft); setDraft(result.trim())
      onNotice('success', `${tool[0].toUpperCase() + tool.slice(1)} pass applied. You can undo it in Scratchpad.`)
    } catch (error) { setAiProgress(null); onNotice('error', `Local prompt tool failed: ${error instanceof Error ? error.message : String(error)}`) }
    finally { setBusy(null) }
  }
  const acceptCompletion = (range: { start: number; end: number }) => { if (!completion) return; editor.current?.insertText(completion, range); setCompletion('') }
  const copyCompiled = async () => {
    await navigator.clipboard.writeText(compiled)
    setCopied(true); window.setTimeout(() => setCopied(false), 1400)
  }

  return <div className="scratchpad-workspace">
    <header className="scratchpad-hero"><div><span className="scratchpad-kicker"><Sparkles size={13} />提示词工坊</span><h1>Scratchpad</h1><p>Write freely, shape ideas with your local model, inspect the final payload, then send it directly into a production workspace.</p></div><div className={`scratchpad-status ${connectionError ? 'error' : ''}`} role="status" aria-live="polite"><i className={available ? 'ready' : ''} /><span><strong>{checking ? `Checking ${provider === 'ollama' ? 'Ollama' : 'LM Studio'}…` : available ? selectedModel : '本地模型离线'}</strong><small>{available ? `${provider === 'ollama' ? 'Ollama' : 'LM Studio'} · ${models.length} local model${models.length === 1 ? '' : 's'} ready` : connectionError || '在设置中连接提供商'}</small></span><button type="button" onClick={onRefresh} disabled={checking} title={`Refresh ${provider === 'ollama' ? 'Ollama' : 'LM Studio'} connection`} aria-label={`Refresh ${provider === 'ollama' ? 'Ollama' : 'LM Studio'} connection`}>{checking ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}</button></div></header>
    <div className="scratchpad-layout">
      <section className="scratchpad-canvas">
        <header><div><FileText size={16} /><span><strong>Draft</strong><small>{words} words · {draft.length.toLocaleString()} characters · saved locally</small></span></div><div><button type="button" disabled={!beforeAi} onClick={() => { setDraft(beforeAi); setBeforeAi('') }}><RotateCcw size={14} />Undo AI</button><button type="button" disabled={!draft} onClick={() => { if (window.confirm('清除草稿？')) { setDraft(''); setBeforeAi('') } }}><Eraser size={14} />Clear</button></div></header>
        <H3PromptEditor ref={editor} value={draft} onChange={setDraft} ariaLabel="草稿提示词" placeholder="先写个想法，或输入 ## 创建结构化 H3 段落…" completion={completion} onAcceptCompletion={acceptCompletion} />
        {(completionStatus === 'waiting' || completionStatus === 'working' || completionStatus === 'error') && <div className={`scratchpad-completion-status ${completionStatus === 'error' ? 'error' : ''}`} role="status" aria-live="polite">{completionStatus === 'error' ? <><span>Inline autocomplete could not reach {provider === 'ollama' ? 'Ollama' : 'LM Studio'}: {completionError}</span><button type="button" onClick={onRefresh}>Reconnect</button></> : <><LoaderCircle className="spin" size={12} /><span>{completionStatus === 'waiting' ? 'Autocomplete queued…' : `${provider === 'ollama' ? 'Ollama' : 'LM Studio'} is writing locally…`}</span></>}</div>}
        {aiProgress && <section className="create-prompt-thinking" aria-label="本地 AI 进度"><header><strong>{busy ? 'Local model is working…' : '本地模型已完成'}</strong><small role="status" aria-live="polite">{!busy ? '已应用到草稿' : aiProgress.content ? '已接收草稿' : aiProgress.thinking ? 'Thinking' : '等待模型响应'}</small></header><details open={Boolean(busy)}><summary>模型思考中</summary><pre>{aiProgress.thinking ? aiProgress.thinking.slice(-4000) : '该模型未发送推理文本。'}</pre></details></section>}
        <footer><span>Type <code>##</code> for tags · right-click for the tag menu</span><label><input type="checkbox" checked={completionEnabled} onChange={event => setCompletionEnabled(event.target.checked)} />本地行内自动补全</label></footer>
      </section>
      <aside className="scratchpad-tools">
        <section><header><WandSparkles size={15} /><span><strong>本地写作工具</strong><small>编辑内容仅保存在本机</small></span></header><div className="scratchpad-tool-grid">{([
          ['refine', 'Refine', '润色并澄清'], ['expand', 'Expand', '添加制作细节'], ['concise', 'Condense', '精简而不丢失信息'], ['structure', '添加 H3 标签', '创建清晰的章节'], ['timeline', '镜头时间线', '构建定时动作'], ['audio', '音频处理', '音效与对白'],
        ] as const).map(([id, label, note]) => <button type="button" key={id} disabled={!available || !draft.trim() || Boolean(busy)} onClick={() => void runTool(id)}>{busy === id ? <LoaderCircle className="spin" size={15} /> : id === 'audio' ? <MessageSquareText size={15} /> : id === 'timeline' ? <Clock3 size={15} /> : <Sparkles size={15} />}<span><strong>{label}</strong><small>{note}</small></span></button>)}</div></section>
        <section className="scratchpad-model"><label><span>写作模型</span><select value={selectedModel} disabled={!models.length} onChange={event => onModelChange(event.target.value)}>{models.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><small>{models.length ? `${provider === 'ollama' ? 'Ollama' : 'LM Studio'} is connected at ${url}` : '启动本地模型服务器后，请刷新连接。'}</small></section>
      </aside>
      <section className="scratchpad-compiler">
        <header><div><Clipboard size={16} /><span><strong>编译后的提示词</strong><small>Exact destination-ready output</small></span></div><button type="button" disabled={!compiled} onClick={() => void copyCompiled()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button></header>
        <div className="scratchpad-destinations" role="tablist" aria-label="编译目标">{targets.map(item => <button type="button" role="tab" aria-selected={target === item.id} className={target === item.id ? 'active' : ''} key={item.id} onClick={() => setTarget(item.id)}><strong>{item.label}</strong><small>{item.note}</small></button>)}</div>
        {target === 'h3' && <label className="scratchpad-duration"><span>Clip duration</span><input type="number" min={1} max={60} value={duration} onChange={event => setDuration(Math.max(1, Math.min(60, Number(event.target.value) || 1)))} /><small>seconds</small></label>}
        <pre>{compiled || '编译后的提示词将显示在此处。'}</pre>
        <footer><span>{target === 'h3' ? 'Tagged source remains editable; H3 recompiles it authoritatively when rendering.' : '结构化标签在此目标中将被展平。'}</span><button type="button" className="primary-button" disabled={!draft.trim()} onClick={() => onSend(target, draft, compiled)}>Send to {targets.find(item => item.id === target)?.label}<ArrowRight size={15} /></button></footer>
      </section>
    </div>
  </div>
}
