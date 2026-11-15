// Pure geometry and state helpers for the infinite-canvas workspace shell.
// Kept free of React and DOM globals so scripts/test-infinite-canvas.cjs can
// transpile and exercise it directly (see scripts/test-ts-loader.cjs).

export const INFINITE_CANVAS_STORAGE_KEY = 'oyama.infinite-canvas.layout.v1'
export const CANVAS_STATE_VERSION = 1
export const CANVAS_MIN_SCALE = 0.25
export const CANVAS_MAX_SCALE = 2.5
export const CANVAS_GRID = 24
export const CANVAS_NODE_WIDTH = 236
export const CANVAS_NODE_HEIGHT = 108
export const CANVAS_GROUP_PADDING = 22
export const CANVAS_GROUP_GAP_X = 96
export const CANVAS_NODE_GAP_Y = 26
export const CANVAS_ORIGIN_X = 120
export const CANVAS_ORIGIN_Y = 150
export const CANVAS_COORD_LIMIT = 1000000

export type CanvasWorkspaceRef = {
  view: string
  engine?: string
  label: string
  description: string
  group: string
}

export type CanvasNode = {
  id: string
  kind: 'workspace' | 'note' | 'group'
  x: number
  y: number
  w: number
  h: number
  title: string
  view?: string
  engine?: string
  group?: string
  description?: string
  text?: string
}

export type CanvasEdge = { id: string; from: string; to: string }
export type CanvasViewport = { x: number; y: number; scale: number }
export type CanvasState = {
  version: number
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  viewport: CanvasViewport
}
export type CanvasPoint = { x: number; y: number }
export type CanvasRect = { x: number; y: number; w: number; h: number }

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, finite(value, fallback)))
}

export function clampScale(scale: number): number {
  return bounded(scale, 1, CANVAS_MIN_SCALE, CANVAS_MAX_SCALE)
}

export function normalizeViewport(viewport: Partial<CanvasViewport> | null | undefined): CanvasViewport {
  if (!viewport || typeof viewport !== 'object') return { x: 0, y: 0, scale: 1 }
  return {
    x: bounded(viewport.x, 0, -CANVAS_COORD_LIMIT, CANVAS_COORD_LIMIT),
    y: bounded(viewport.y, 0, -CANVAS_COORD_LIMIT, CANVAS_COORD_LIMIT),
    scale: clampScale(finite(viewport.scale, 1)),
  }
}

export function screenToWorld(viewport: CanvasViewport, screenX: number, screenY: number): CanvasPoint {
  const vp = normalizeViewport(viewport)
  return { x: (screenX - vp.x) / vp.scale, y: (screenY - vp.y) / vp.scale }
}

export function worldToScreen(viewport: CanvasViewport, worldX: number, worldY: number): CanvasPoint {
  const vp = normalizeViewport(viewport)
  return { x: worldX * vp.scale + vp.x, y: worldY * vp.scale + vp.y }
}

export function zoomAt(viewport: CanvasViewport, factor: number, screenX: number, screenY: number): CanvasViewport {
  const vp = normalizeViewport(viewport)
  const next = clampScale(vp.scale * finite(factor, 1))
  const world = screenToWorld(vp, screenX, screenY)
  return { scale: next, x: screenX - world.x * next, y: screenY - world.y * next }
}

export function panBy(viewport: CanvasViewport, dx: number, dy: number): CanvasViewport {
  const vp = normalizeViewport(viewport)
  return {
    scale: vp.scale,
    x: bounded(vp.x + finite(dx, 0), vp.x, -CANVAS_COORD_LIMIT, CANVAS_COORD_LIMIT),
    y: bounded(vp.y + finite(dy, 0), vp.y, -CANVAS_COORD_LIMIT, CANVAS_COORD_LIMIT),
  }
}

export function nodeRect(node: CanvasNode): CanvasRect {
  return { x: node.x, y: node.y, w: node.w, h: node.h }
}

export function nodeBounds(nodes: CanvasNode[]): CanvasRect | null {
  const boxes = nodes.filter(node => node.kind !== 'group').map(nodeRect)
  if (!boxes.length) return null
  const minX = Math.min(...boxes.map(b => b.x))
  const minY = Math.min(...boxes.map(b => b.y))
  const maxX = Math.max(...boxes.map(b => b.x + b.w))
  const maxY = Math.max(...boxes.map(b => b.y + b.h))
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function fitViewport(nodes: CanvasNode[], width: number, height: number, padding = 80): CanvasViewport {
  const bounds = nodeBounds(nodes)
  const safeW = Math.max(1, finite(width, 1280))
  const safeH = Math.max(1, finite(height, 800))
  if (!bounds || bounds.w <= 0 || bounds.h <= 0) return { x: padding, y: padding, scale: 1 }
  const pad = bounded(padding, 80, 0, 400)
  const scale = clampScale(Math.min((safeW - pad * 2) / bounds.w, (safeH - pad * 2) / bounds.h))
  return {
    scale,
    x: safeW / 2 - (bounds.x + bounds.w / 2) * scale,
    y: safeH / 2 - (bounds.y + bounds.h / 2) * scale,
  }
}

export function workspaceNodeId(view: string, engine?: string): string {
  return 'ws:' + view + ':' + (engine ?? '')
}

export function buildInitialState(destinations: CanvasWorkspaceRef[]): CanvasState {
  const groups: string[] = []
  const byGroup = new Map<string, CanvasWorkspaceRef[]>()
  for (const item of destinations) {
    if (!item || typeof item.view !== 'string' || !item.view) continue
    if (!byGroup.has(item.group)) {
      byGroup.set(item.group, [])
      groups.push(item.group)
    }
    byGroup.get(item.group)!.push(item)
  }
  const nodes: CanvasNode[] = []
  const edges: CanvasEdge[] = []
  const columnWidth = CANVAS_NODE_WIDTH + CANVAS_GROUP_GAP_X
  groups.forEach((group, groupIndex) => {
    const items = byGroup.get(group) ?? []
    const x = CANVAS_ORIGIN_X + groupIndex * columnWidth
    const height = items.length * (CANVAS_NODE_HEIGHT + CANVAS_NODE_GAP_Y) - CANVAS_NODE_GAP_Y
    nodes.push({
      id: 'group:' + group,
      kind: 'group',
      x: x - CANVAS_GROUP_PADDING,
      y: CANVAS_ORIGIN_Y - 54,
      w: CANVAS_NODE_WIDTH + CANVAS_GROUP_PADDING * 2,
      h: Math.max(CANVAS_NODE_HEIGHT, height) + 54 + CANVAS_GROUP_PADDING,
      title: group,
      group,
    })
    items.forEach((item, index) => {
      const id = workspaceNodeId(item.view, item.engine)
      nodes.push({
        id,
        kind: 'workspace',
        x,
        y: CANVAS_ORIGIN_Y + index * (CANVAS_NODE_HEIGHT + CANVAS_NODE_GAP_Y),
        w: CANVAS_NODE_WIDTH,
        h: CANVAS_NODE_HEIGHT,
        title: item.label,
        view: item.view,
        engine: item.engine,
        group: item.group,
        description: item.description,
      })
      if (index > 0) {
        edges.push({ id: 'edge:' + items[index - 1].view + '-' + item.view + ':' + groupIndex, from: workspaceNodeId(items[index - 1].view, items[index - 1].engine), to: id })
      }
    })
  })
  return { version: CANVAS_STATE_VERSION, nodes, edges, viewport: fitViewport(nodes, 1440, 900) }
}

let noteSequence = 0
export function nextNoteId(): string {
  noteSequence += 1
  return 'note:' + Date.now().toString(36) + ':' + noteSequence.toString(36)
}

export function moveNode(state: CanvasState, id: string, x: number, y: number): CanvasState {
  return {
    ...state,
    nodes: state.nodes.map(node => node.id === id
      ? { ...node, x: bounded(x, node.x, -CANVAS_COORD_LIMIT, CANVAS_COORD_LIMIT), y: bounded(y, node.y, -CANVAS_COORD_LIMIT, CANVAS_COORD_LIMIT) }
      : node),
  }
}

export function addNote(state: CanvasState, x: number, y: number, text = '', id = nextNoteId()): CanvasState {
  if (state.nodes.some(node => node.id === id)) return state
  return {
    ...state,
    nodes: [...state.nodes, {
      id,
      kind: 'note',
      x: bounded(x, CANVAS_ORIGIN_X, -CANVAS_COORD_LIMIT, CANVAS_COORD_LIMIT),
      y: bounded(y, CANVAS_ORIGIN_Y, -CANVAS_COORD_LIMIT, CANVAS_COORD_LIMIT),
      w: CANVAS_NODE_WIDTH,
      h: CANVAS_NODE_HEIGHT,
      title: '便签',
      text,
    }],
  }
}

export function updateNote(state: CanvasState, id: string, text: string): CanvasState {
  return {
    ...state,
    nodes: state.nodes.map(node => node.id === id && node.kind === 'note' ? { ...node, text } : node),
  }
}

export function removeNode(state: CanvasState, id: string): CanvasState {
  return {
    ...state,
    nodes: state.nodes.filter(node => node.id !== id || node.kind === 'group'),
    edges: state.edges.filter(edge => edge.from !== id && edge.to !== id),
  }
}

export function addEdge(state: CanvasState, from: string, to: string): CanvasState {
  if (!from || !to || from === to) return state
  const known = new Set(state.nodes.filter(node => node.kind !== 'group').map(node => node.id))
  if (!known.has(from) || !known.has(to)) return state
  if (state.edges.some(edge => edge.from === from && edge.to === to)) return state
  return { ...state, edges: [...state.edges, { id: 'edge:' + from + '>' + to, from, to }] }
}

export function removeEdge(state: CanvasState, id: string): CanvasState {
  return { ...state, edges: state.edges.filter(edge => edge.id !== id) }
}

export function edgeAnchor(node: CanvasNode, side: 'out' | 'in'): CanvasPoint {
  const y = node.y + node.h / 2
  return side === 'out' ? { x: node.x + node.w, y } : { x: node.x, y }
}

export function edgePath(from: CanvasNode, to: CanvasNode): string {
  const a = edgeAnchor(from, 'out')
  const b = edgeAnchor(to, 'in')
  const bend = Math.max(48, Math.abs(b.x - a.x) * 0.45)
  return 'M ' + a.x + ' ' + a.y + ' C ' + (a.x + bend) + ' ' + a.y + ', ' + (b.x - bend) + ' ' + b.y + ', ' + b.x + ' ' + b.y
}

export function hitTestNode(nodes: CanvasNode[], worldX: number, worldY: number): CanvasNode | null {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]
    if (node.kind === 'group') continue
    if (worldX >= node.x && worldX <= node.x + node.w && worldY >= node.y && worldY <= node.y + node.h) return node
  }
  return null
}

function sanitizeNode(raw: unknown, allowedGroups: Set<string>): CanvasNode | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const kind = record.kind
  if (kind !== 'workspace' && kind !== 'note' && kind !== 'group') return null
  const id = typeof record.id === 'string' && record.id ? record.id : null
  if (!id) return null
  const x = bounded(record.x, 0, -CANVAS_COORD_LIMIT, CANVAS_COORD_LIMIT)
  const y = bounded(record.y, 0, -CANVAS_COORD_LIMIT, CANVAS_COORD_LIMIT)
  const w = bounded(record.w, CANVAS_NODE_WIDTH, 80, 4000)
  const h = bounded(record.h, CANVAS_NODE_HEIGHT, 60, 4000)
  const title = typeof record.title === 'string' ? record.title.slice(0, 200) : ''
  if (kind === 'group' && !allowedGroups.has(title)) return null
  return {
    id,
    kind,
    x,
    y,
    w,
    h,
    title,
    view: typeof record.view === 'string' ? record.view : undefined,
    engine: typeof record.engine === 'string' ? record.engine : undefined,
    group: typeof record.group === 'string' ? record.group : undefined,
    description: typeof record.description === 'string' ? record.description.slice(0, 600) : undefined,
    text: typeof record.text === 'string' ? record.text.slice(0, 4000) : undefined,
  }
}

export function sanitizeCanvasState(raw: unknown, destinations: CanvasWorkspaceRef[]): CanvasState {
  const fallback = buildInitialState(destinations)
  if (!raw || typeof raw !== 'object') return fallback
  const record = raw as Record<string, unknown>
  const allowedGroups = new Set(destinations.map(item => item.group))
  const seen = new Set<string>()
  const nodes: CanvasNode[] = []
  if (Array.isArray(record.nodes)) {
    for (const entry of record.nodes.slice(0, 500)) {
      const node = sanitizeNode(entry, allowedGroups)
      if (!node || seen.has(node.id)) continue
      seen.add(node.id)
      nodes.push(node)
    }
  }
  // Every workspace destination must have exactly one matching card; add missing
  // ones and drop stale cards whose view is no longer offered by the navigator.
  const expected = new Map(destinations.map(item => [workspaceNodeId(item.view, item.engine), item]))
  const present = new Set(nodes.filter(node => node.kind === 'workspace').map(node => node.id))
  const clean = nodes.filter(node => node.kind !== 'workspace' || expected.has(node.id))
  for (const id of expected.keys()) {
    if (present.has(id)) continue
    const template = fallback.nodes.find(node => node.id === id)
    if (template) clean.push(template)
  }
  const ids = new Set(clean.map(node => node.id))
  const edges: CanvasEdge[] = []
  const edgeIds = new Set<string>()
  if (Array.isArray(record.edges)) {
    for (const entry of record.edges.slice(0, 1000)) {
      if (!entry || typeof entry !== 'object') continue
      const edge = entry as Record<string, unknown>
      const from = typeof edge.from === 'string' ? edge.from : ''
      const to = typeof edge.to === 'string' ? edge.to : ''
      const id = typeof edge.id === 'string' && edge.id ? edge.id : 'edge:' + from + '>' + to
      if (!from || !to || from === to || !ids.has(from) || !ids.has(to) || edgeIds.has(id)) continue
      edgeIds.add(id)
      edges.push({ id, from, to })
    }
  }
  return {
    version: CANVAS_STATE_VERSION,
    nodes: clean,
    edges,
    viewport: normalizeViewport(record.viewport as Partial<CanvasViewport> | undefined),
  }
}

export function parseCanvasState(text: string | null | undefined, destinations: CanvasWorkspaceRef[]): CanvasState {
  if (!text) return buildInitialState(destinations)
  try {
    return sanitizeCanvasState(JSON.parse(text), destinations)
  } catch {
    return buildInitialState(destinations)
  }
}

export function serializeCanvasState(state: CanvasState): string {
  return JSON.stringify({
    version: CANVAS_STATE_VERSION,
    nodes: state.nodes,
    edges: state.edges,
    viewport: normalizeViewport(state.viewport),
  })
}

export function hasSavedCanvasState(storage: Pick<Storage, 'getItem'>): boolean {
  try {
    const text = storage.getItem(INFINITE_CANVAS_STORAGE_KEY)
    if (!text) return false
    const parsed: unknown = JSON.parse(text)
    return Boolean(parsed) && typeof parsed === 'object' && Array.isArray((parsed as { nodes?: unknown }).nodes)
  } catch {
    return false
  }
}

export function readCanvasState(storage: Pick<Storage, 'getItem'>, destinations: CanvasWorkspaceRef[]): CanvasState {
  try {
    return parseCanvasState(storage.getItem(INFINITE_CANVAS_STORAGE_KEY), destinations)
  } catch {
    return buildInitialState(destinations)
  }
}

export function writeCanvasState(state: CanvasState, storage: Pick<Storage, 'setItem'> = localStorage): boolean {
  try {
    storage.setItem(INFINITE_CANVAS_STORAGE_KEY, serializeCanvasState(state))
    return true
  } catch {
    return false
  }
}
