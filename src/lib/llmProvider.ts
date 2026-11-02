import type { AppSettings } from '../types'

export type LlmConnection = { provider: AppSettings['llmProvider']; url: string; model: string; label: 'Ollama' | 'LM Studio' | 'llama.cpp' }

export function resolveLlmConnection(settings: AppSettings): LlmConnection {
  if (settings.llmProvider === 'lmstudio')
    return { provider: 'lmstudio', url: settings.lmStudioUrl, model: settings.lmStudioModel, label: 'LM Studio' }
  if (settings.llmProvider === 'llama')
    return { provider: 'llama', url: settings.llamaUrl, model: settings.llamaModel, label: 'llama.cpp' }
  return { provider: 'ollama', url: settings.ollamaUrl, model: settings.ollamaModel, label: 'Ollama' }
}
