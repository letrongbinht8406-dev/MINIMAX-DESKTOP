import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { View } from '../types'
import type { MusicEngine, WorkspaceDestination } from '../lib/workspaceNavigation'
import {
  CANVAS_GRID,
  addEdge,
  addNote,
  buildInitialState,
  edgePath,
  fitViewport,
  hasSavedCanvasState,
  moveNode,
  normalizeViewport,
  readCanvasState,
  removeNode,
  screenToWorld,
  updateNote,
  writeCanvasState,
  zoomAt,
  type CanvasState,
  type CanvasWorkspaceRef,
} from '../lib/infiniteCanvas'
import '../infinite-canvas.css'

type DragState =
  | { mode: 'pan'; pointerId: number; startX: number; startY: number; originX: number; originY: number }
  | { mode: 'node'; pointerId: number; id: string; offsetX: number; offsetY: number }

type InfiniteCanvasProps = {
  destinations: WorkspaceDestination[]
  onOpenWorkspace: (view: View, engine?: MusicEngine) => void
  onExit: () => void
}

function toRefs(destinations: WorkspaceDestination[]): CanvasWorkspaceRef[] {
  return destinations.map(item => ({
    view: item.view,
    engine: item.engine,
    label: item.label,
    description: item.description,
    group: item.group,
  }))
}

export function InfiniteCanvas({ destinations, onOpenWorkspace, onExit }: InfiniteCanvasProps) {
  const refs = useMemo(() => toRefs(destinations), [destinations])
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [state, setState] = useState<CanvasState>(() => {
    const saved = hasSavedCanvasState(window.localStorage)
    const initial = readCanvasState(window.localStorage, refs)
    // A first-run layout is fitted to the real window instead of the 1440x900
    // reference used by buildInitialState(); a saved layout keeps its viewport.
    return saved ? initial : {
      ...initial,
      viewport: fitViewport(initial.nodes, window.innerWidth, Math.max(360, window.innerHeight - 120)),
    }
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [linkFrom, setLinkFrom] = useState<string | null>(null)
  const [linkMode, setLinkMode] = useState(false)
  const [status, setStatus] = useState('无限画布已就绪：拖动空白处平移，滚轮缩放，双击卡片进入工作区。')

  const nodeById = useMemo(() => new Map(state.nodes.map(node => [node.id, node])), [state.nodes])
  const { x, y, scale } = normalizeViewport(state.viewport)

  useEffect(() => {
    writeCanvasState(state)
  }, [state])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1
      setState(previous => ({
        ...previous,
        viewport: zoomAt(previous.viewport, factor, event.clientX - rect.left, event.clientY - rect.top),
      }))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (event.key === 'Escape') {
        setLinkMode(false)
        setLinkFrom(null)
        setSelectedId(null)
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        setState(previous => removeNode(previous, selectedId))
        setSelectedId(null)
        setStatus('已删除选中的节点。')
        return
      }
      if (event.key === '0' || event.key === 'f' || event.key === 'F') {
        const element = containerRef.current
        if (element) {
          setState(previous => ({
            ...previous,
            viewport: fitViewport(previous.nodes, element.clientWidth, element.clientHeight),
          }))
          setStatus('已适应全部内容。')
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId])

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const viewport = normalizeViewport(state.viewport)
    dragRef.current = {
      mode: 'pan',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    }
    containerRef.current?.setPointerCapture(event.pointerId)
  }

  const startNodeDrag = (event: ReactPointerEvent<HTMLDivElement>, id: string, nodeX: number, nodeY: number) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const world = screenToWorld(state.viewport, event.clientX - rect.left, event.clientY - rect.top)
    dragRef.current = {
      mode: 'node',
      pointerId: event.pointerId,
      id,
      offsetX: world.x - nodeX,
      offsetY: world.y - nodeY,
    }
    containerRef.current?.setPointerCapture(event.pointerId)
    setSelectedId(id)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (drag.mode === 'pan') {
      setState(previous => ({
        ...previous,
        viewport: normalizeViewport({
          ...previous.viewport,
          x: drag.originX + (event.clientX - drag.startX),
          y: drag.originY + (event.clientY - drag.startY),
        }),
      }))
      return
    }
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setState(previous => {
      const world = screenToWorld(previous.viewport, event.clientX - rect.left, event.clientY - rect.top)
      return moveNode(previous, drag.id, world.x - drag.offsetX, world.y - drag.offsetY)
    })
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
    if (containerRef.current?.hasPointerCapture(event.pointerId)) {
      containerRef.current.releasePointerCapture(event.pointerId)
    }
  }

  const handleCardClick = (id: string) => {
    if (!linkMode) {
      setSelectedId(id)
      return
    }
    if (!linkFrom) {
      setLinkFrom(id)
      setStatus('已选起点，再点一张卡片完成连线。')
      return
    }
    setState(previous => addEdge(previous, linkFrom, id))
    setStatus('连线已建立。')
    setLinkFrom(null)
    setLinkMode(false)
  }

  const openWorkspace = (view: string, engine?: string) => {
    onOpenWorkspace(view as View, engine as MusicEngine | undefined)
  }

  const fit = () => {
    const element = containerRef.current
    if (!element) return
    setState(previous => ({
      ...previous,
      viewport: fitViewport(previous.nodes, element.clientWidth, element.clientHeight),
    }))
    setStatus('已适应全部内容。')
  }

  const zoomBy = (factor: number) => {
    const element = containerRef.current
    if (!element) return
    setState(previous => ({
      ...previous,
      viewport: zoomAt(previous.viewport, factor, element.clientWidth / 2, element.clientHeight / 2),
    }))
  }

  const groupNodes = state.nodes.filter(node => node.kind === 'group')
  const cardNodes = state.nodes.filter(node => node.kind !== 'group')

  return (
    <div className="infinite-canvas-root">
      <div className="infinite-canvas-toolbar">
        <div className="infinite-canvas-brand">
          <strong>无限画布</strong>
          <span>{destinations.length} 个工作区 · 一张画布</span>
        </div>
        <div className="infinite-canvas-actions">
          <button type="button" onClick={() => { setState(buildInitialState(refs)); setStatus('布局已重置。') }}>重置布局</button>
          <button type="button" onClick={() => { setState(previous => addNote(previous, -x / scale + 80, -y / scale + 80)); setStatus('已添加便签。') }}>添加便签</button>
          <button
            type="button"
            className={linkMode ? 'is-active' : ''}
            onClick={() => { setLinkMode(previous => !previous); setLinkFrom(null); setStatus(linkMode ? '已取消连线模式。' : '连线模式：依次点击两张卡片。') }}
          >
            {linkMode ? '取消连线' : '连线'}
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.2)} aria-label="缩小">−</button>
          <span className="infinite-canvas-zoom" aria-label="当前缩放">{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => zoomBy(1.2)} aria-label="放大">+</button>
          <button type="button" onClick={fit}>适应视图</button>
          <button type="button" className="infinite-canvas-exit" onClick={onExit}>返回经典模式</button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="infinite-canvas-surface"
        style={{
          backgroundSize: CANVAS_GRID * scale + 'px ' + CANVAS_GRID * scale + 'px',
          backgroundPosition: x + 'px ' + y + 'px',
        }}
        onPointerDown={startPan}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerDownCapture={event => {
          if (event.target === event.currentTarget) setSelectedId(null)
        }}
      >
        <div
          className="infinite-canvas-world"
          style={{ transform: 'translate(' + x + 'px, ' + y + 'px) scale(' + scale + ')' }}
        >
          {groupNodes.map(node => (
            <div
              key={node.id}
              className="infinite-canvas-group"
              style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
            >
              <span>{node.title}</span>
            </div>
          ))}

          <svg className="infinite-canvas-edges" aria-hidden="true">
            <defs>
              <marker id="infinite-canvas-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor" />
              </marker>
            </defs>
            {state.edges.map(edge => {
              const from = nodeById.get(edge.from)
              const to = nodeById.get(edge.to)
              if (!from || !to) return null
              return (
                <g key={edge.id} className="infinite-canvas-edge">
                  <path d={edgePath(from, to)} markerEnd="url(#infinite-canvas-arrow)" />
                  <title>{from.title} → {to.title}</title>
                </g>
              )
            })}
          </svg>

          {cardNodes.map(node => {
            const isSelected = selectedId === node.id
            const isLinkSource = linkFrom === node.id
            return (
              <div
                key={node.id}
                className={[
                  'infinite-canvas-card',
                  'infinite-canvas-card-' + node.kind,
                  isSelected ? 'is-selected' : '',
                  isLinkSource ? 'is-link-source' : '',
                ].filter(Boolean).join(' ')}
                style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
                onPointerDown={event => event.stopPropagation()}
                onClick={() => handleCardClick(node.id)}
                onDoubleClick={() => { if (node.kind === 'workspace' && node.view) openWorkspace(node.view, node.engine) }}
              >
                <div
                  className="infinite-canvas-card-head"
                  onPointerDown={event => startNodeDrag(event, node.id, node.x, node.y)}
                >
                  <span className="infinite-canvas-card-title">{node.title}</span>
                  {node.kind === 'workspace' ? (
                    <button
                      type="button"
                      className="infinite-canvas-open"
                      onPointerDown={event => event.stopPropagation()}
                      onClick={event => { event.stopPropagation(); if (node.view) openWorkspace(node.view, node.engine) }}
                    >
                      打开 →
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="infinite-canvas-open"
                      onPointerDown={event => event.stopPropagation()}
                      onClick={event => {
                        event.stopPropagation()
                        setState(previous => removeNode(previous, node.id))
                        setStatus('便签已删除。')
                      }}
                    >
                      删除
                    </button>
                  )}
                </div>
                {node.kind === 'workspace' ? (
                  <div className="infinite-canvas-card-body">
                    <span className="infinite-canvas-group-tag">{node.group}</span>
                    <p>{node.description}</p>
                  </div>
                ) : (
                  <textarea
                    className="infinite-canvas-note"
                    value={node.text ?? ''}
                    placeholder="写点什么…"
                    onPointerDown={event => event.stopPropagation()}
                    onChange={event => setState(previous => updateNote(previous, node.id, event.target.value))}
                  />
                )}
                <span
                  className="infinite-canvas-handle infinite-canvas-handle-in"
                  onPointerDown={event => event.stopPropagation()}
                  onClick={event => { event.stopPropagation(); handleCardClick(node.id) }}
                  aria-hidden="true"
                />
                <span
                  className="infinite-canvas-handle infinite-canvas-handle-out"
                  onPointerDown={event => event.stopPropagation()}
                  onClick={event => { event.stopPropagation(); handleCardClick(node.id) }}
                  aria-hidden="true"
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="infinite-canvas-status" role="status" aria-live="polite">
        <span>{status}</span>
        <span>布局自动保存 · Delete 删除选中 · 0 / F 适应 · Esc 取消</span>
      </div>
    </div>
  )
}
