/**
 * Infinite canvas workspace regression tests.
 *
 * Exercises the pure geometry/state module through scripts/test-ts-loader.cjs
 * (real transpiled calls, not string matching), matching the existing suite's
 * convention. Covers viewport math, initial layout from workspaceDestinations,
 * node/edge mutation, tolerant persistence recovery and storage failures.
 */
const assert = require('node:assert/strict')
const { load } = require('./test-ts-loader.cjs')

const canvas = load('src/lib/infiniteCanvas.ts')
const { workspaceDestinations } = load('src/lib/workspaceNavigation.ts')

const {
  INFINITE_CANVAS_STORAGE_KEY,
  CANVAS_STATE_VERSION,
  CANVAS_MIN_SCALE,
  CANVAS_MAX_SCALE,
  CANVAS_NODE_WIDTH,
  CANVAS_NODE_HEIGHT,
  clampScale,
  normalizeViewport,
  screenToWorld,
  worldToScreen,
  zoomAt,
  panBy,
  nodeBounds,
  fitViewport,
  hasSavedCanvasState,
  workspaceNodeId,
  buildInitialState,
  moveNode,
  addNote,
  updateNote,
  removeNode,
  addEdge,
  removeEdge,
  edgePath,
  hitTestNode,
  sanitizeCanvasState,
  parseCanvasState,
  serializeCanvasState,
  readCanvasState,
  writeCanvasState,
} = canvas

function assertViewport(actual, expected, label) {
  assert.equal(actual.x, expected.x, label + ' x')
  assert.equal(actual.y, expected.y, label + ' y')
  assert.equal(actual.scale, expected.scale, label + ' scale')
}

const destinations = workspaceDestinations.map(item => ({
  view: item.view,
  engine: item.engine,
  label: item.label,
  description: item.description,
  group: item.group,
}))

// 1) Scale + viewport clamping
assert.equal(clampScale(1), 1)
assert.equal(clampScale(0.0001), CANVAS_MIN_SCALE)
assert.equal(clampScale(999), CANVAS_MAX_SCALE)
assert.equal(clampScale(Number.NaN), 1, 'non-finite scale falls back to the neutral default')
assert.equal(clampScale(Number.POSITIVE_INFINITY), 1)
assertViewport(normalizeViewport(null), { x: 0, y: 0, scale: 1 })
assertViewport(normalizeViewport({ x: Number.NaN, y: 1e12, scale: 7 }), { x: 0, y: 1000000, scale: CANVAS_MAX_SCALE })

// 2) Coordinate transforms + anchor-preserving zoom
const vp = { x: 130, y: -40, scale: 1.5 }
const world = screenToWorld(vp, 400, 260)
const roundtrip = worldToScreen(vp, world.x, world.y)
assert.ok(Math.abs(roundtrip.x - 400) < 1e-9)
assert.ok(Math.abs(roundtrip.y - 260) < 1e-9)
const zoomed = zoomAt(vp, 2, 400, 260)
assert.equal(zoomed.scale, 3 > CANVAS_MAX_SCALE ? CANVAS_MAX_SCALE : 3, 'zoom clamps at the maximum')
const anchored = worldToScreen(zoomed, world.x, world.y)
assert.ok(Math.abs(anchored.x - 400) < 1e-9, 'zoom keeps the cursor world point fixed (x)')
assert.ok(Math.abs(anchored.y - 260) < 1e-9, 'zoom keeps the cursor world point fixed (y)')
assertViewport(panBy(vp, 25, -10), { x: 155, y: -50, scale: 1.5 })

// 3) Initial layout: one card per destination, one frame per group, unique ids
const initial = buildInitialState(destinations)
assert.equal(initial.version, CANVAS_STATE_VERSION)
assert.equal(initial.nodes.filter(n => n.kind === 'workspace').length, 20, 'all 20 destinations get a card')
assert.equal(initial.nodes.filter(n => n.kind === 'group').length, 4, '创作/准备素材/审阅与编辑/设置 group frames')
assert.equal(new Set(initial.nodes.map(n => n.id)).size, initial.nodes.length, 'ids are unique')
for (const item of destinations) {
  const id = workspaceNodeId(item.view, item.engine)
  const node = initial.nodes.find(n => n.id === id)
  assert.ok(node, 'missing card for ' + id)
  assert.equal(node.title, item.label)
  assert.equal(node.group, item.group)
  assert.equal(node.w, CANVAS_NODE_WIDTH)
  assert.equal(node.h, CANVAS_NODE_HEIGHT)
}
assert.equal(initial.edges.length, 16, 'sequential edges within the four groups')
assert.ok(initial.edges.every(e => initial.nodes.some(n => n.id === e.from) && initial.nodes.some(n => n.id === e.to)))
assert.ok(initial.viewport.scale >= CANVAS_MIN_SCALE && initial.viewport.scale <= CANVAS_MAX_SCALE)

// 4) Bounds + fit
const bounds = nodeBounds(initial.nodes)
assert.ok(bounds && bounds.w > 0 && bounds.h > 0)
const fitted = fitViewport(initial.nodes, 1440, 900)
const center = worldToScreen(fitted, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2)
assert.ok(Math.abs(center.x - 720) < 1e-6, 'fit centers horizontally')
assert.ok(Math.abs(center.y - 450) < 1e-6, 'fit centers vertically')
assertViewport(fitViewport([], 1440, 900), { x: 80, y: 80, scale: 1 })

// 5) Node mutation
const first = initial.nodes.find(n => n.kind === 'workspace')
const moved = moveNode(initial, first.id, 42, -7)
assert.equal(moved.nodes.find(n => n.id === first.id).x, 42)
assert.equal(initial.nodes.find(n => n.id === first.id).x, first.x, 'moveNode is immutable')
const clamped = moveNode(initial, first.id, Number.POSITIVE_INFINITY, -1e12)
assert.equal(clamped.nodes.find(n => n.id === first.id).y, -1000000)

const withNote = addNote(initial, 300, 400, '先写分镜', 'note:test')
assert.equal(withNote.nodes.length, initial.nodes.length + 1)
assert.equal(withNote.nodes.find(n => n.id === 'note:test').text, '先写分镜')
assert.equal(addNote(withNote, 300, 400, '', 'note:test').nodes.length, withNote.nodes.length, 'duplicate note id is ignored')
assert.equal(updateNote(withNote, 'note:test', '改过的便签').nodes.find(n => n.id === 'note:test').text, '改过的便签')
assert.equal(updateNote(withNote, first.id, 'nope').nodes.find(n => n.id === first.id).text, undefined, 'only notes are editable')

const linked = addEdge(withNote, first.id, 'note:test')
assert.equal(linked.edges.length, withNote.edges.length + 1)
const edgeId = linked.edges[linked.edges.length - 1].id
assert.equal(addEdge(linked, first.id, 'note:test').edges.length, linked.edges.length, 'duplicate edge ignored')
assert.equal(addEdge(linked, first.id, first.id).edges.length, linked.edges.length, 'self-link rejected')
assert.equal(addEdge(linked, first.id, 'ghost').edges.length, linked.edges.length, 'unknown target rejected')
assert.equal(removeEdge(linked, edgeId).edges.length, withNote.edges.length)
const removed = removeNode(linked, first.id)
assert.ok(!removed.nodes.some(n => n.id === first.id), 'node removed')
assert.ok(removed.nodes.some(n => n.kind === 'group'), 'group frames survive node removal')
assert.ok(!removed.edges.some(e => e.from === first.id || e.to === first.id), 'incident edges cascade')
assert.equal(removeNode(linked, 'group:创作').nodes.length, linked.nodes.length, 'group frames cannot be deleted')

// 6) Edge geometry + hit testing
const a = initial.nodes.find(n => n.id === 'ws:scratchpad:')
const b = initial.nodes.find(n => n.id === 'ws:create:')
const path = edgePath(a, b)
assert.match(path, /^M [\d.-]+ [\d.-]+ C [\d.-]+ [\d.-]+, [\d.-]+ [\d.-]+, [\d.-]+ [\d.-]+$/, 'cubic bezier path')
assert.equal(hitTestNode(initial.nodes, a.x + 5, a.y + 5).id, a.id)
assert.equal(hitTestNode(initial.nodes, -99999, -99999), null)
assert.equal(hitTestNode([{ ...a, kind: 'group' }], a.x + 5, a.y + 5), null, 'group frames are not hit targets')

// 7) Tolerant persistence
const badJson = parseCanvasState('{broken', destinations)
assert.equal(badJson.nodes.filter(n => n.kind === 'workspace').length, 20)
assert.equal(parseCanvasState(null, destinations).nodes.length, initial.nodes.length)
assert.equal(parseCanvasState('', destinations).viewport.scale, initial.viewport.scale, 'empty state falls back to the fitted default layout')

const partial = sanitizeCanvasState({
  nodes: [{ id: 'ws:scratchpad:', kind: 'workspace', x: 10, y: 20, w: 5, h: Number.NaN, title: '草稿', view: 'scratchpad', group: '创作' }],
  edges: [{ id: 'e1', from: 'ws:scratchpad:', to: 'ws:create:' }, { id: 'e2', from: 'ws:scratchpad:', to: 'ghost' }, { from: 'ws:scratchpad:', to: 'ws:scratchpad:' }],
  viewport: { x: 12, y: 34, scale: 99 },
}, destinations)
assert.equal(partial.nodes.filter(n => n.kind === 'workspace').length, 20, 'missing destination cards are restored')
assert.equal(partial.nodes.find(n => n.id === 'ws:scratchpad:').x, 10, 'valid saved position is preserved')
assert.equal(partial.nodes.find(n => n.id === 'ws:scratchpad:').w, 80, 'width clamped to minimum')
assert.equal(partial.nodes.find(n => n.id === 'ws:scratchpad:').h, CANVAS_NODE_HEIGHT, 'bad height falls back')
assert.equal(partial.viewport.scale, CANVAS_MAX_SCALE)
assert.ok(partial.edges.some(e => e.id === 'e1'), 'valid edge kept')
assert.ok(!partial.edges.some(e => e.id === 'e2'), 'edge to unknown node dropped')
assert.ok(!partial.edges.some(e => e.from === e.to), 'self-loop dropped')

const withStale = sanitizeCanvasState({
  nodes: [...initial.nodes, { id: 'ws:retired:', kind: 'workspace', x: 0, y: 0, w: 236, h: 108, title: '旧工作区', view: 'retired', group: '创作' }],
  edges: [], viewport: initial.viewport,
}, destinations)
assert.ok(!withStale.nodes.some(n => n.id === 'ws:retired:'), 'retired workspace cards are dropped')
assert.equal(sanitizeCanvasState({ nodes: 'not-an-array', edges: null }, destinations).nodes.filter(n => n.kind === 'workspace').length, 20)

// 8) Serialization + storage failure
const text = serializeCanvasState(initial)
assert.equal(JSON.parse(text).version, CANVAS_STATE_VERSION)
assert.equal(parseCanvasState(text, destinations).nodes.length, initial.nodes.length)
const saved = new Map()
assert.equal(writeCanvasState(initial, { setItem: (k, v) => saved.set(k, v) }), true)
assert.equal(saved.has(INFINITE_CANVAS_STORAGE_KEY), true)
assert.equal(writeCanvasState(initial, { setItem() { throw new Error('Quota exceeded') } }), false, 'quota failure returns false')
assert.equal(readCanvasState({ getItem: () => saved.get(INFINITE_CANVAS_STORAGE_KEY) }, destinations).nodes.length, initial.nodes.length)
assert.equal(readCanvasState({ getItem() { throw new Error('blocked') } }, destinations).nodes.length, initial.nodes.length, 'blocked storage falls back to defaults')
assert.equal(hasSavedCanvasState({ getItem: () => null }), false, 'no saved layout')
assert.equal(hasSavedCanvasState({ getItem: () => '{broken' }), false, 'corrupt saved layout')
assert.equal(hasSavedCanvasState({ getItem: () => '{"nodes":[]}' }), true, 'valid saved layout')
assert.equal(hasSavedCanvasState({ getItem: () => saved.get(INFINITE_CANVAS_STORAGE_KEY) }), true, 'round-tripped layout')

console.log('PASS: infinite canvas viewport math, 20-workspace layout, node/edge mutation, tolerant recovery and storage failures')
