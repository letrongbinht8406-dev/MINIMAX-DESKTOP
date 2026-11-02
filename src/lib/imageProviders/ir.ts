/**
 * Graph IR — providers describe *what* the nodes are and how they relate, never
 * numeric node ids. `lowerGraph` assigns ids and rewrites links at the end.
 *
 * This is the single most important boundary in the project: providers stay
 * readable, output extraction stays declarative, and swapping ComfyUI for
 * another graph runtime only touches `lowerGraph`.
 */
export type NodeKey = string

export interface NodeRef {
  node: NodeKey
  slot?: number
}

export type GraphInputs = Record<string, unknown>

export interface GraphNode {
  classType: string
  inputs: GraphInputs
}

export interface GraphIR {
  nodes: Record<NodeKey, GraphNode>
  /** artifact slot -> the sink node that produces it */
  outputs: Record<string, NodeKey>
  warnings?: string[]
}

export interface ComfyNode {
  class_type: string
  inputs: Record<string, unknown>
}

export type ComfyPrompt = Record<string, ComfyNode>

export interface LoweredGraph {
  prompt: ComfyPrompt
  /** artifact slot -> numeric node id, used to read results back */
  outputIds: Record<string, string>
  order: NodeKey[]
  ids: Record<NodeKey, string>
}

export const ref = (node: NodeKey, slot = 0): NodeRef => ({ node, slot })

export function isNodeRef(value: unknown): value is NodeRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    'node' in value &&
    typeof (value as { node?: unknown }).node === 'string'
  )
}

/** Resolve a dotted input path such as `ref_images.ref_image_0`. */
function mapValue(value: unknown, ids: Record<NodeKey, string>): unknown {
  if (isNodeRef(value)) {
    const id = ids[value.node]
    if (!id) throw new Error(`Graph references undeclared node "${value.node}"`)
    return [id, value.slot ?? 0]
  }
  if (Array.isArray(value)) return value.map((item) => mapValue(item, ids))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = mapValue(v, ids)
    return out
  }
  return value
}

export function lowerGraph(ir: GraphIR): LoweredGraph {
  const order: NodeKey[] = []
  const state = new Map<NodeKey, 1 | 2>()

  const visit = (key: NodeKey, path: NodeKey[]) => {
    if (state.get(key) === 2) return
    if (state.get(key) === 1) throw new Error(`Cycle in graph: ${[...path, key].join(' -> ')}`)
    const node = ir.nodes[key]
    if (!node) throw new Error(`Graph references undeclared node "${key}"`)
    state.set(key, 1)
    for (const value of Object.values(node.inputs)) {
      if (isNodeRef(value)) visit(value.node, [...path, key])
      else if (Array.isArray(value)) {
        for (const item of value) if (isNodeRef(item)) visit(item.node, [...path, key])
      }
    }
    state.set(key, 2)
    order.push(key)
  }

  for (const key of Object.keys(ir.nodes)) visit(key, [])

  const ids: Record<NodeKey, string> = {}
  order.forEach((key, index) => {
    ids[key] = String(index + 1)
  })

  const prompt: ComfyPrompt = {}
  for (const key of order) {
    const node = ir.nodes[key]
    prompt[ids[key]] = {
      class_type: node.classType,
      inputs: mapValue(node.inputs, ids) as Record<string, unknown>,
    }
  }

  const outputIds: Record<string, string> = {}
  for (const [slot, key] of Object.entries(ir.outputs)) {
    const id = ids[key]
    if (!id) throw new Error(`Graph output "${slot}" points at undeclared node "${key}"`)
    outputIds[slot] = id
  }

  return { prompt, outputIds, order, ids }
}
