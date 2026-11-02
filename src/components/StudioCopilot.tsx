import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Copy, LoaderCircle, Pin, PinOff, RefreshCw, Send, Sparkles, X } from 'lucide-react'
import type { LlmConnection } from '../lib/llmProvider'
import type { LocalLlmStatus, OllamaModel } from '../types'

type CopilotMode = 'polish' | 'review' | 'rewrite'
type CopilotMessage = { id: string; role: 'user' | 'assistant'; content: string; thinking?: string; error?: boolean }

export type StudioCopilotProps = {
  prompt: string
  mode: 'reference' | 'text' | 'image' | 'frames'
  duration: number
  firstFrame?: string
  lastFrame?: string
  referenceNames: string[]
  characterNames: string[]
  locationNames: string[]
  noDialogue: boolean
  llm: LlmConnection
  llmModels: OllamaModel[]
  llmStatus?: LocalLlmStatus | null | null
  llmChecking: boolean
  onModelChange(model: string): void
  onRefreshLlm(): void
  onApplyText(text: string): void
}

const modeMeta: Array<{ id: CopilotMode; label: string; hint: string }> = [
  { id: 'polish', label: '优化', hint: '完善当前提示词' },
  { id: 'review', label: '审阅', hint: '找出问题并给建议' },
  { id: 'rewrite', label: '改写', hint: '按新要求重写' }
]

function buildContext(props: Pick<StudioCopilotProps, 'prompt' | 'mode' | 'duration' | 'firstFrame' | 'lastFrame' | 'referenceNames' | 'characterNames' | 'locationNames' | 'noDialogue'>): string {
  const lines = [
    `模式: ${props.mode === 'reference' ? '参考素材' : props.mode === 'text' ? '文生视频' : props.mode === 'image' ? '图生视频' : '首尾帧'}`,
    `时长: ${props.duration} 秒`,
    props.noDialogue ? '对白: 已关闭' : '对白: 允许',
    `当前提示词:\n${props.prompt.trim() || '(空)'}`
  ]
  if (props.referenceNames.length) lines.push(`参考素材: ${props.referenceNames.join('、')}`)
  if (props.characterNames.length) lines.push(`角色: ${props.characterNames.join('、')}`)
  if (props.locationNames.length) lines.push(`场景地点: ${props.locationNames.join('、')}`)
  if (props.firstFrame) lines.push(`起始帧: ${props.firstFrame.split(/[\\/]/).pop()}`)
  if (props.lastFrame) lines.push(`结束帧: ${props.lastFrame.split(/[\\/]/).pop()}`)
  return lines.join('\n')
}

function systemPrompt(mode: CopilotMode, context: string): string {
  const base = `你是 MiniMax Studio（Oyama 视频工作台）的提示词助手，帮助用户写本地视频生成模型的 H3/LTX 分镜提示词。请用中文回复。当前工作台上下文：\n${context}`
  if (mode === 'polish') return `${base}\n任务：优化“当前提示词”——保留核心内容与镜头意图，让画面、动作、运镜、光线、节奏描述更具体；控制在一小段内；只输出优化后的提示词，不要解释。`
  if (mode === 'review') return `${base}\n任务：审阅“当前提示词”，列出最多 5 个具体问题（歧义、缺失的运动/镜头/光线描述、与模式不匹配等），每条一行，给出可操作的修改建议。`
  return `${base}\n任务：按用户要求重写“当前提示词”；用户没有给要求时，把当前提示词扩展成一个完整分镜（主体、动作、镜头运动、光线、节奏）。只输出提示词本身。`
}

let seq = 0
const nextId = () => `copilot-${Date.now()}-${seq++}`

export function StudioCopilot(props: StudioCopilotProps) {
  const { prompt, llm, llmModels, llmStatus, llmChecking, onModelChange, onRefreshLlm, onApplyText } = props
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<CopilotMode>('polish')
  const [draft, setDraft] = useState('')
  const [log, setLog] = useState<CopilotMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [pinned, setPinned] = useState(false)
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [log, busy])

  useEffect(() => {
    if (!open && log.length === 0) setPinned(false)
  }, [open, log.length])

  const context = useMemo(
    () => buildContext({
      prompt: props.prompt,
      mode: props.mode,
      duration: props.duration,
      firstFrame: props.firstFrame,
      lastFrame: props.lastFrame,
      referenceNames: props.referenceNames,
      characterNames: props.characterNames,
      locationNames: props.locationNames,
      noDialogue: props.noDialogue,
    }),
    [props.prompt, props.mode, props.duration, props.firstFrame, props.lastFrame, props.referenceNames, props.characterNames, props.locationNames, props.noDialogue]
  )

  const connected = Boolean(llmStatus?.connected)

  const send = async (message: string, activeMode: CopilotMode) => {
    const text = message.trim()
    if (!text || busy) return
    const userMsg: CopilotMessage = { id: nextId(), role: 'user', content: text }
    const assistantMsg: CopilotMessage = { id: nextId(), role: 'assistant', content: '', thinking: '' }
    setLog(current => [...current, userMsg, assistantMsg])
    setDraft('')
    setBusy(true)
    try {
      const fullPrompt = `${systemPrompt(activeMode, context)}\n\n用户要求：${text}`
      await window.minimax.generateWithOllama(
        llm.url,
        llm.model,
        fullPrompt,
        llm.provider,
        (update) => {
          setLog(current => current.map(item => item.id === assistantMsg.id ? { ...item, thinking: update.thinking, content: update.content } : item))
        }
      )
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error)
      setLog(current => current.map(item => item.id === assistantMsg.id ? { ...item, content: item.content || `无法连接到 ${llm.label}：${messageText}`, error: true } : item))
    } finally {
      setBusy(false)
    }
  }

  const applyToPrompt = (message: CopilotMessage) => {
    const fenced = message.content.match(/```[a-z]*\n?([\s\S]*?)```/i)
    const text = (fenced ? fenced[1] : message.content).trim()
    if (text) onApplyText(text)
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* clipboard unavailable */
    }
  }

  const togglePin = async () => {
    const next = !pinned
    setPinned(next)
    try {
      await window.minimax.setWindowAlwaysOnTop(next)
    } catch {
      /* window helper unavailable in browser preview */
    }
  }

  const visibleMessages = log.slice(-30)

  return (
    <div className="ai-chat-head">
      {open && (
        <div className="ai-chat-panel" role="dialog" aria-label="Studio 提示词助手">
          <header>
            <div>
              <span><Bot size={17} /></span>
              <div>
                <strong>Studio 助手</strong>
                <small>{llm.model ? `${llm.label} · ${llm.model}` : `${llm.label} · 未选择模型`}</small>
              </div>
            </div>
            <div className="ai-chat-window-actions">
              <button type="button" className={`icon-button ${pinned ? 'active' : ''}`} title={pinned ? '取消窗口置顶' : '窗口置顶'} onClick={togglePin}>
                {pinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
              <button type="button" className="icon-button" title="关闭助手" onClick={() => setOpen(false)}>
                <X size={14} />
              </button>
            </div>
          </header>
          <div className="ai-chat-modes" role="tablist" aria-label="助手模式">
            {modeMeta.map(item => (
              <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} className={mode === item.id ? 'active' : ''} title={item.hint} onClick={() => setMode(item.id)}>
                <Sparkles size={12} />{item.label}
              </button>
            ))}
          </div>
          <div className="ai-chat-model-row">
            <label htmlFor="copilot-model">模型</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 6, alignItems: 'center' }}>
              <select id="copilot-model" value={llm.model} onChange={event => onModelChange(event.target.value)} disabled={llmModels.length === 0}>
                {llmModels.length === 0 ? <option value="">未检测到本地模型</option> : llmModels.map(model => <option key={model.name} value={model.name}>{model.name}</option>)}
              </select>
              <button type="button" className="icon-button" title="检测本地模型" onClick={onRefreshLlm} disabled={llmChecking}>
                {llmChecking ? <LoaderCircle className="spin" size={13} /> : <RefreshCw size={13} />}
              </button>
            </div>
          </div>
          <div className="ai-chat-context">
            <span><Sparkles size={11} />上下文：{props.referenceNames.length + props.characterNames.length} 个素材 · {props.duration}s</span>
          </div>
          <div className="ai-chat-log" ref={logRef}>
            {visibleMessages.length === 0 ? (
              <div className="ai-chat-empty">
                <Bot size={26} />
                <strong>提示词助手</strong>
                <span>{connected ? '选择一种模式，或直接输入要求。' : `${llm.label} 未连接——在 设置 → 本地 AI 里启动服务并测试。`}</span>
              </div>
            ) : visibleMessages.map(message => (
              <article key={message.id} className={`${message.role === 'user' ? 'user' : ''} ${message.role === 'assistant' ? (message.error ? '' : 'prompt-response') : ''} ${message.thinking ? 'thinking' : ''}`}>
                <small>{message.role === 'user' ? '你' : message.error ? '助手 · 出错了' : '助手'}</small>
                {message.thinking && <p style={{ color: 'var(--muted-2)' }}>{message.thinking}</p>}
                {message.content ? <p>{message.content}</p> : busy && message.role === 'assistant' && <p style={{ color: 'var(--muted)' }}>正在思考…</p>}
                {message.role === 'assistant' && !message.error && message.content && !busy && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button type="button" className="icon-button" style={{ fontSize: 8 }} onClick={() => applyToPrompt(message)} title="应用到提示词框"><Copy size={11} />应用到提示词</button>
                    <button type="button" className="icon-button" style={{ fontSize: 8 }} onClick={() => void copy(message.content)} title="复制"><Copy size={11} />复制</button>
                  </div>
                )}
              </article>
            ))}
          </div>
          <div className="ai-chat-handoff">
            <button type="button" onClick={() => void send(mode === 'review' ? '按上面审阅结果改进提示词' : mode === 'rewrite' ? '把当前提示词扩展成一个完整分镜' : '帮我优化当前提示词', mode)} disabled={busy || !connected && !prompt.trim()}>
              {busy ? <LoaderCircle className="spin" size={13} /> : <Sparkles size={13} />}
              {busy ? '助手正在处理…' : `一键${modeMeta.find(item => item.id === mode)?.label ?? '优化'}当前提示词`}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '0 10px 8px' }}>
            <input
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(draft, mode) } }}
              placeholder="描述你想要助手做什么…"
              style={{ flex: 1, minHeight: 34, padding: '6px 9px', border: '1px solid var(--line-strong)', borderRadius: 7, background: 'var(--bg)', color: 'var(--text)', font: 'inherit', fontSize: 10 }}
              disabled={busy}
            />
            <button type="button" className="icon-button" style={{ border: '1px solid var(--line-strong)' }} title="发送" onClick={() => void send(draft, mode)} disabled={busy || !draft.trim()}>
              <Send size={13} />
            </button>
          </div>
          <p className="ai-chat-shortcut">{connected ? `已连接 ${llm.label} · ${llm.model}` : `未连接 ${llm.label}——先在设置里测试连接`} · 按 Enter 发送</p>
        </div>
      )}
      <button type="button" className="ai-chat-toggle" onClick={() => setOpen(current => !current)} aria-expanded={open} title={open ? '收起 Studio 助手' : '打开 Studio 助手'}>
        {open ? <X size={16} /> : <Bot size={18} />}
        <span>AI</span>
      </button>
    </div>
  )
}
