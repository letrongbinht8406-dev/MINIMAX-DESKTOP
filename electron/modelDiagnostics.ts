/**
 * 模型目录诊断（纯逻辑，无 Electron 依赖，可直接被 scripts/test-ts-loader.cjs 加载）。
 *
 * 为什么需要它：scanDirectory 对不存在的目录静默返回 []，界面只显示「0 个文件」，
 * 用户无法区分「目录配错了」与「目录里确实没有该类模型」。Comfy Desktop 的做法是
 * 在 Issues 面板明确列出缺失模型与路径，这里对齐同一诊断口径。
 *
 * 运行时字符串保持 ASCII；展示文案在 UI 层。
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

export type ModelPathStatus = 'ok' | 'empty' | 'missing' | 'unreadable'

export interface ModelPathDiagnostic {
  kind: string
  path: string
  status: ModelPathStatus
  fileCount: number
}

export interface ModelPathSummary {
  total: number
  ok: number
  empty: number
  missing: number
  unreadable: number
  files: number
}

/** 与 electron/main.ts 的 scanDirectory 保持同一组扩展名 */
export const MODEL_FILE_EXTENSIONS = ['.safetensors', '.pt', '.pth', '.gguf', '.onnx'] as const
const extensions = new Set<string>(MODEL_FILE_EXTENSIONS)
/** 模型目录可能按家族分多层；限制深度，避免误配置的盘符根目录被整个遍历 */
const MAX_DEPTH = 4

type DirEntry = { name: string; isDirectory(): boolean; isFile(): boolean }

function countModelFiles(root: string, depth = 0): number {
  if (depth > MAX_DEPTH) return 0
  let entries: DirEntry[]
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return -1
  }
  let count = 0
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = join(root, entry.name)
    if (entry.isDirectory()) {
      const nested = countModelFiles(full, depth + 1)
      if (nested < 0) return -1
      count += nested
    } else if (entry.isFile() && extensions.has(extname(entry.name).toLowerCase())) {
      count += 1
    }
  }
  return count
}

export function diagnoseModelPath(kind: string, path: string): ModelPathDiagnostic {
  const location = typeof path === 'string' ? path.trim() : ''
  if (!location) return { kind, path: location, status: 'missing', fileCount: 0 }
  try {
    if (!existsSync(location) || !statSync(location).isDirectory()) {
      return { kind, path: location, status: 'missing', fileCount: 0 }
    }
  } catch {
    return { kind, path: location, status: 'missing', fileCount: 0 }
  }
  const fileCount = countModelFiles(location)
  if (fileCount < 0) return { kind, path: location, status: 'unreadable', fileCount: 0 }
  return { kind, path: location, status: fileCount > 0 ? 'ok' : 'empty', fileCount }
}

export function diagnoseModelPaths(paths: Record<string, string>): ModelPathDiagnostic[] {
  return Object.entries(paths ?? {}).map(([kind, path]) => diagnoseModelPath(kind, path))
}

export function summarizeModelPaths(items: ModelPathDiagnostic[]): ModelPathSummary {
  const summary: ModelPathSummary = { total: items.length, ok: 0, empty: 0, missing: 0, unreadable: 0, files: 0 }
  for (const item of items) {
    summary[item.status] += 1
    summary.files += item.fileCount
  }
  return summary
}
