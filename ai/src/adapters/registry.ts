import { OllamaAdapter } from './ollama.js'
import { LMStudioAdapter } from './lmstudio.js'
import { OpenAIAdapter } from './openai.js'
import { ClaudeAdapter } from './claude.js'
import { OpenRouterAdapter } from './openrouter.js'
import type { AIAdapter } from './types.js'
import { config } from '../config.js'

export interface ProviderConfig {
  provider: 'ollama' | 'lmstudio' | 'openai' | 'claude' | 'gemini' | 'openrouter' | 'custom'
  baseUrl?: string
  apiKey?: string
  model?: string
}

export function buildAdapter(cfg: ProviderConfig): AIAdapter {
  switch (cfg.provider) {
    case 'ollama':
      return new OllamaAdapter(cfg.baseUrl ?? config.ollamaBaseUrl, cfg.model ?? config.defaultModel)
    case 'lmstudio':
      return new LMStudioAdapter(cfg.baseUrl ?? config.lmstudioBaseUrl, cfg.model ?? config.defaultModel)
    case 'openai':
      return new OpenAIAdapter(cfg.apiKey ?? '', cfg.model ?? 'gpt-4o-mini', cfg.baseUrl)
    case 'claude':
      return new ClaudeAdapter(cfg.apiKey ?? '', cfg.model ?? 'claude-3-haiku-20240307')
    case 'openrouter':
      return new OpenRouterAdapter(cfg.apiKey ?? '', cfg.model ?? 'meta-llama/llama-3-8b-instruct')
    case 'custom':
      return new LMStudioAdapter(cfg.baseUrl ?? config.lmstudioBaseUrl, cfg.model ?? config.defaultModel)
    default:
      return new OllamaAdapter(config.ollamaBaseUrl, config.defaultModel)
  }
}

export function buildDefaultAdapter(): AIAdapter {
  return buildAdapter({
    provider: config.defaultProvider,
    baseUrl: config.defaultProvider === 'ollama' ? config.ollamaBaseUrl : config.lmstudioBaseUrl,
    model: config.defaultModel,
  })
}
