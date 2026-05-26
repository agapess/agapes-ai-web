# Phase 2 — AI Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full AI orchestration layer — multi-provider support, context-aware prompting, code extraction, credit gating, chat persistence, and admin/user provider config UIs — so chatting with Ollama generates live React websites in the Sandpack preview.

**Architecture:** The AI service is stateless; the web service resolves provider configs from the DB, pre-checks credits, builds project context, and passes everything to the AI service as part of the stream request. The AI service runs the provider adapter, extracts code blocks from the response, and emits `preview_update` SSE events. Credits are deducted by the web service after a successful stream via a fire-and-forget POST.

**Tech Stack:** Express (ai service), Next.js API routes (web service), Drizzle ORM, AES-256-GCM encryption, Zod, Vitest, Anthropic SDK, OpenAI SDK, node-fetch for OpenAI-compat adapters.

---

## File Map

```
ai/
  src/
    adapters/
      lmstudio.ts          NEW — OpenAI-compat adapter for LM Studio
      openai.ts            NEW — OpenAI adapter (official SDK)
      claude.ts            NEW — Anthropic adapter (official SDK)
      openrouter.ts        NEW — OpenRouter adapter (OpenAI-compat)
      registry.ts          NEW — maps provider name → adapter instance
    orchestrator/
      contextBuilder.ts    NEW — builds system prompt + message array
      codeExtractor.ts     NEW — extracts + validates code blocks from stream
      index.ts             NEW — main orchestrator (resolve → context → stream → extract)
    routes/
      chat.ts              MODIFY — use orchestrator instead of direct adapter

shared/
  src/
    schemas.ts             MODIFY — extend chatRequestSchema with providerConfig + messages

web/
  src/
    lib/
      encryption.ts        NEW — AES-256-GCM encrypt/decrypt for API keys
      credits.ts           NEW — credit check, deduct, refund helpers
      seed.ts              NEW — seed default platform Ollama provider on first run
    app/
      api/
        providers/
          route.ts         NEW — GET/POST user provider configs
          [id]/route.ts    NEW — PATCH/DELETE user provider config
        admin/
          providers/
            route.ts       NEW — GET/POST platform provider configs (admin only)
            [id]/route.ts  NEW — PATCH/DELETE platform provider (admin only)
        chat-sessions/
          [projectId]/
            route.ts       NEW — GET/POST chat session for a project
        ai/
          stream/
            route.ts       MODIFY — resolve provider, build context, pre-check credits, proxy
          complete/
            route.ts       NEW — POST called by browser after SSE done to deduct credits
      settings/
        providers/
          page.tsx         NEW — user provider settings server page
          ProvidersClient.tsx  NEW — client component
      admin/
        providers/
          page.tsx         NEW — admin platform provider management
          AdminProvidersClient.tsx  NEW — client component
```

---

## Task 1: Extend Shared Schema + Install AI SDKs

**Files:**
- Modify: `shared/src/schemas.ts`
- Modify: `ai/package.json`

- [ ] **Step 1: Update chatRequestSchema in shared/src/schemas.ts**

Replace the entire file:

```typescript
import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['draft', 'published']).optional(),
  theme: z.record(z.unknown()).optional(),
})

export const providerConfigSchema = z.object({
  provider: z.enum(['ollama', 'lmstudio', 'openai', 'claude', 'gemini', 'openrouter', 'custom']),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
})

export const chatRequestSchema = z.object({
  projectId: z.string(),
  message: z.string().min(1).max(10000),
  // History so AI service can build multi-turn context
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().default([]),
  // Resolved provider config (web service resolves, AI service uses)
  providerConfig: providerConfigSchema.optional(),
  // Current page content as JSON string (component tree)
  projectContext: z.string().optional(),
})

export const upsertProviderConfigSchema = z.object({
  provider: z.enum(['ollama', 'lmstudio', 'openai', 'claude', 'gemini', 'openrouter', 'custom']),
  displayName: z.string().min(1).max(80),
  baseUrl: z.string().url().optional().or(z.literal('')),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
  allowedPlans: z.array(z.enum(['free', 'pro', 'enterprise'])).optional().default(['free', 'pro', 'enterprise']),
  creditCostPerRequest: z.number().int().min(0).optional().default(0),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type ChatRequestInput = z.infer<typeof chatRequestSchema>
export type ProviderConfigInput = z.infer<typeof providerConfigSchema>
export type UpsertProviderConfigInput = z.infer<typeof upsertProviderConfigSchema>
```

- [ ] **Step 2: Rebuild shared**

```bash
cd "i:/VS Code/Website_Bulder"
pnpm --filter @ai-builder/shared build
```

Expected: `shared/dist/` updated, zero errors.

- [ ] **Step 3: Add AI SDK deps to ai/package.json**

In `ai/package.json` dependencies, add:
```json
"openai": "^4.47.1",
"@anthropic-ai/sdk": "^0.24.3"
```

```bash
pnpm --filter ai install
```

- [ ] **Step 4: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add shared/src/schemas.ts shared/dist/ ai/package.json pnpm-lock.yaml
git commit -m "feat: extend chat schema with provider config + history"
```

---

## Task 2: Additional Provider Adapters

**Files:**
- Create: `ai/src/adapters/lmstudio.ts`
- Create: `ai/src/adapters/openai.ts`
- Create: `ai/src/adapters/claude.ts`
- Create: `ai/src/adapters/openrouter.ts`
- Create: `ai/src/adapters/__tests__/adapters.test.ts`

All adapters implement the same `AIAdapter` interface from `./types.ts`.

- [ ] **Step 1: Write failing tests**

Create `ai/src/adapters/__tests__/adapters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { LMStudioAdapter } from '../lmstudio.js'
import { OpenAIAdapter } from '../openai.js'
import { ClaudeAdapter } from '../claude.js'
import { OpenRouterAdapter } from '../openrouter.js'

describe('LMStudioAdapter', () => {
  const adapter = new LMStudioAdapter('http://127.0.0.1:19999', 'test-model')
  it('has name lmstudio', () => expect(adapter.name).toBe('lmstudio'))
  it('estimateCredits returns 0', () => {
    expect(adapter.estimateCredits({ messages: [], model: 'x' })).toBe(0)
  })
  it('isAvailable returns false when unreachable', async () => {
    expect(await adapter.isAvailable()).toBe(false)
  })
})

describe('OpenAIAdapter', () => {
  const adapter = new OpenAIAdapter('sk-fake', 'gpt-4o-mini')
  it('has name openai', () => expect(adapter.name).toBe('openai'))
  it('estimateCredits returns > 0', () => {
    expect(adapter.estimateCredits({ messages: [{ role: 'user', content: 'hi' }], model: 'gpt-4o-mini' })).toBeGreaterThan(0)
  })
})

describe('ClaudeAdapter', () => {
  const adapter = new ClaudeAdapter('sk-ant-fake', 'claude-3-haiku-20240307')
  it('has name claude', () => expect(adapter.name).toBe('claude'))
  it('estimateCredits returns > 0', () => {
    expect(adapter.estimateCredits({ messages: [{ role: 'user', content: 'hi' }], model: 'claude-3-haiku-20240307' })).toBeGreaterThan(0)
  })
})

describe('OpenRouterAdapter', () => {
  const adapter = new OpenRouterAdapter('sk-or-fake', 'meta-llama/llama-3-8b-instruct')
  it('has name openrouter', () => expect(adapter.name).toBe('openrouter'))
  it('estimateCredits returns > 0', () => {
    expect(adapter.estimateCredits({ messages: [{ role: 'user', content: 'hi' }], model: 'meta-llama/llama-3-8b-instruct' })).toBeGreaterThan(0)
  })
})
```

```bash
cd "i:/VS Code/Website_Bulder/ai"
pnpm test
```

Expected: FAIL — adapters not defined yet.

- [ ] **Step 2: Create ai/src/adapters/lmstudio.ts**

LM Studio exposes an OpenAI-compatible API at `/v1/chat/completions`.

```typescript
import type { AIAdapter, AIChunk, AIRequest, Model } from './types.js'

export class LMStudioAdapter implements AIAdapter {
  readonly name = 'lmstudio'

  constructor(
    private readonly baseUrl: string,
    private readonly defaultModel: string,
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        signal: AbortSignal.timeout(3000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async listModels(): Promise<Model[]> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`)
      if (!res.ok) return []
      const data = await res.json() as { data: Array<{ id: string }> }
      return data.data.map(m => ({ id: m.id, name: m.id }))
    } catch {
      return []
    }
  }

  async *stream(req: AIRequest): AsyncGenerator<AIChunk> {
    const model = req.model || this.defaultModel
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: req.messages, stream: true }),
      })
    } catch (err) {
      yield { type: 'error', message: `LM Studio unreachable: ${String(err)}` }
      return
    }

    if (!res.ok || !res.body) {
      yield { type: 'error', message: `LM Studio responded with ${res.status}` }
      return
    }

    yield* streamOpenAICompat(res.body)
  }

  estimateCredits(_req: AIRequest): number {
    return 0
  }
}

// Shared SSE parser for OpenAI-compatible streaming responses
export async function* streamOpenAICompat(body: ReadableStream<Uint8Array>): AsyncGenerator<AIChunk> {
  const decoder = new TextDecoder()
  const reader = body.getReader()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') {
          yield { type: 'done' }
          return
        }
        try {
          const json = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>
          }
          const delta = json.choices?.[0]?.delta?.content
          if (delta) yield { type: 'text_delta', content: delta }
          if (json.choices?.[0]?.finish_reason === 'stop') {
            yield { type: 'done' }
            return
          }
        } catch {
          // skip unparseable line
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  yield { type: 'done' }
}
```

- [ ] **Step 3: Create ai/src/adapters/openai.ts**

```typescript
import OpenAI from 'openai'
import type { AIAdapter, AIChunk, AIRequest, Model } from './types.js'

export class OpenAIAdapter implements AIAdapter {
  readonly name = 'openai'
  private client: OpenAI

  constructor(
    private readonly apiKey: string,
    private readonly defaultModel: string,
    baseUrl?: string,
  ) {
    this.client = new OpenAI({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    })
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list()
      return true
    } catch {
      return false
    }
  }

  async listModels(): Promise<Model[]> {
    try {
      const res = await this.client.models.list()
      return res.data
        .filter(m => m.id.startsWith('gpt') || m.id.startsWith('o1') || m.id.startsWith('o3'))
        .map(m => ({ id: m.id, name: m.id }))
    } catch {
      return []
    }
  }

  async *stream(req: AIRequest): AsyncGenerator<AIChunk> {
    try {
      const stream = await this.client.chat.completions.create({
        model: req.model || this.defaultModel,
        messages: req.messages,
        stream: true,
      })

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content
        if (delta) yield { type: 'text_delta', content: delta }
        if (chunk.choices[0]?.finish_reason === 'stop') {
          yield { type: 'done' }
          return
        }
      }
      yield { type: 'done' }
    } catch (err) {
      yield { type: 'error', message: String(err) }
    }
  }

  estimateCredits(req: AIRequest): number {
    // Rough estimate: 1 credit per ~500 chars of input
    const inputChars = req.messages.reduce((sum, m) => sum + m.content.length, 0)
    return Math.max(1, Math.ceil(inputChars / 500))
  }
}
```

- [ ] **Step 4: Create ai/src/adapters/claude.ts**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { AIAdapter, AIChunk, AIRequest, Model } from './types.js'

export class ClaudeAdapter implements AIAdapter {
  readonly name = 'claude'
  private client: Anthropic

  constructor(
    private readonly apiKey: string,
    private readonly defaultModel: string,
  ) {
    this.client = new Anthropic({ apiKey })
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Anthropic has no list-models endpoint; attempt a minimal request
      await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      })
      return true
    } catch {
      return false
    }
  }

  async listModels(): Promise<Model[]> {
    // Anthropic doesn't expose a models endpoint; return known models
    return [
      { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
    ]
  }

  async *stream(req: AIRequest): AsyncGenerator<AIChunk> {
    // Separate system messages from user/assistant messages
    const systemMessages = req.messages.filter(m => m.role === 'system')
    const chatMessages = req.messages.filter(m => m.role !== 'system')
    const system = systemMessages.map(m => m.content).join('\n') || undefined

    try {
      const stream = await this.client.messages.stream({
        model: req.model || this.defaultModel,
        max_tokens: 8192,
        ...(system ? { system } : {}),
        messages: chatMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      })

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'text_delta', content: event.delta.text }
        }
        if (event.type === 'message_stop') {
          yield { type: 'done' }
          return
        }
      }
      yield { type: 'done' }
    } catch (err) {
      yield { type: 'error', message: String(err) }
    }
  }

  estimateCredits(req: AIRequest): number {
    const inputChars = req.messages.reduce((sum, m) => sum + m.content.length, 0)
    return Math.max(1, Math.ceil(inputChars / 500))
  }
}
```

- [ ] **Step 5: Create ai/src/adapters/openrouter.ts**

OpenRouter is OpenAI-compatible at `https://openrouter.ai/api/v1`.

```typescript
import { streamOpenAICompat } from './lmstudio.js'
import type { AIAdapter, AIChunk, AIRequest, Model } from './types.js'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

export class OpenRouterAdapter implements AIAdapter {
  readonly name = 'openrouter'

  constructor(
    private readonly apiKey: string,
    private readonly defaultModel: string,
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${OPENROUTER_BASE}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async listModels(): Promise<Model[]> {
    try {
      const res = await fetch(`${OPENROUTER_BASE}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })
      if (!res.ok) return []
      const data = await res.json() as { data: Array<{ id: string; name: string }> }
      return data.data.map(m => ({ id: m.id, name: m.name }))
    } catch {
      return []
    }
  }

  async *stream(req: AIRequest): AsyncGenerator<AIChunk> {
    let res: Response
    try {
      res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://ai-website-builder',
          'X-Title': 'AI Website Builder',
        },
        body: JSON.stringify({
          model: req.model || this.defaultModel,
          messages: req.messages,
          stream: true,
        }),
      })
    } catch (err) {
      yield { type: 'error', message: `OpenRouter unreachable: ${String(err)}` }
      return
    }

    if (!res.ok || !res.body) {
      yield { type: 'error', message: `OpenRouter responded with ${res.status}` }
      return
    }

    yield* streamOpenAICompat(res.body)
  }

  estimateCredits(req: AIRequest): number {
    const inputChars = req.messages.reduce((sum, m) => sum + m.content.length, 0)
    return Math.max(1, Math.ceil(inputChars / 500))
  }
}
```

- [ ] **Step 6: Run tests — all should pass now**

```bash
cd "i:/VS Code/Website_Bulder/ai"
pnpm test
```

Expected: 11 tests PASS (3 existing Ollama + 8 new adapter tests).

- [ ] **Step 7: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add ai/src/adapters/
git commit -m "feat: LM Studio, OpenAI, Claude, OpenRouter adapters"
```

---

## Task 3: Provider Registry

**Files:**
- Create: `ai/src/adapters/registry.ts`
- Create: `ai/src/adapters/__tests__/registry.test.ts`

The registry builds adapter instances from a resolved provider config and falls back to the env-configured Ollama default.

- [ ] **Step 1: Write failing test**

Create `ai/src/adapters/__tests__/registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildAdapter } from '../registry.js'

describe('buildAdapter', () => {
  it('returns OllamaAdapter for provider ollama', () => {
    const adapter = buildAdapter({ provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'llama3.2' })
    expect(adapter.name).toBe('ollama')
  })

  it('returns LMStudioAdapter for provider lmstudio', () => {
    const adapter = buildAdapter({ provider: 'lmstudio', baseUrl: 'http://localhost:1234', model: 'test' })
    expect(adapter.name).toBe('lmstudio')
  })

  it('returns OpenAIAdapter for provider openai', () => {
    const adapter = buildAdapter({ provider: 'openai', apiKey: 'sk-fake', model: 'gpt-4o-mini' })
    expect(adapter.name).toBe('openai')
  })

  it('returns ClaudeAdapter for provider claude', () => {
    const adapter = buildAdapter({ provider: 'claude', apiKey: 'sk-ant-fake', model: 'claude-3-haiku-20240307' })
    expect(adapter.name).toBe('claude')
  })

  it('returns OpenRouterAdapter for provider openrouter', () => {
    const adapter = buildAdapter({ provider: 'openrouter', apiKey: 'sk-or-fake', model: 'meta-llama/llama-3-8b-instruct' })
    expect(adapter.name).toBe('openrouter')
  })

  it('falls back to lmstudio for custom with baseUrl', () => {
    const adapter = buildAdapter({ provider: 'custom', baseUrl: 'http://my-server:1234', model: 'custom-model' })
    expect(adapter.name).toBe('lmstudio')
  })
})
```

```bash
cd "i:/VS Code/Website_Bulder/ai" && pnpm test
```

Expected: FAIL — `buildAdapter` not defined.

- [ ] **Step 2: Create ai/src/adapters/registry.ts**

```typescript
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
      // Custom OpenAI-compat endpoint → use LMStudio adapter (same protocol)
      return new LMStudioAdapter(cfg.baseUrl ?? config.lmstudioBaseUrl, cfg.model ?? config.defaultModel)
    default:
      // fallback to Ollama
      return new OllamaAdapter(config.ollamaBaseUrl, config.defaultModel)
  }
}

// Build the default platform adapter from env config
export function buildDefaultAdapter(): AIAdapter {
  return buildAdapter({
    provider: config.defaultProvider,
    baseUrl: config.defaultProvider === 'ollama' ? config.ollamaBaseUrl : config.lmstudioBaseUrl,
    model: config.defaultModel,
  })
}
```

- [ ] **Step 3: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/ai" && pnpm test
```

Expected: 17 tests PASS.

- [ ] **Step 4: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add ai/src/adapters/registry.ts ai/src/adapters/__tests__/registry.test.ts
git commit -m "feat: provider registry — buildAdapter factory"
```

---

## Task 4: Context Builder

**Files:**
- Create: `ai/src/orchestrator/contextBuilder.ts`
- Create: `ai/src/orchestrator/__tests__/contextBuilder.test.ts`

Assembles the message array sent to the LLM: system prompt (role + instructions + project context) + chat history + current user message.

- [ ] **Step 1: Write failing test**

Create `ai/src/orchestrator/__tests__/contextBuilder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildMessages } from '../contextBuilder.js'

describe('buildMessages', () => {
  it('includes a system message as first element', () => {
    const messages = buildMessages({ userMessage: 'hello', history: [], projectContext: undefined })
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('React')
  })

  it('appends history before the current user message', () => {
    const history = [
      { role: 'user' as const, content: 'first' },
      { role: 'assistant' as const, content: 'response' },
    ]
    const messages = buildMessages({ userMessage: 'second', history, projectContext: undefined })
    const userMessages = messages.filter(m => m.role === 'user')
    expect(userMessages[0].content).toBe('first')
    expect(userMessages[1].content).toBe('second')
  })

  it('includes projectContext in system message when provided', () => {
    const messages = buildMessages({ userMessage: 'hi', history: [], projectContext: 'CONTEXT_DATA' })
    expect(messages[0].content).toContain('CONTEXT_DATA')
  })

  it('last message is always the current user message', () => {
    const messages = buildMessages({ userMessage: 'build a navbar', history: [], projectContext: undefined })
    expect(messages[messages.length - 1].role).toBe('user')
    expect(messages[messages.length - 1].content).toBe('build a navbar')
  })
})
```

```bash
cd "i:/VS Code/Website_Bulder/ai" && pnpm test
```

Expected: FAIL — `buildMessages` not defined.

- [ ] **Step 2: Create ai/src/orchestrator/contextBuilder.ts**

```typescript
interface BuildMessagesOptions {
  userMessage: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  projectContext: string | undefined
}

type Message = { role: 'system' | 'user' | 'assistant'; content: string }

const SYSTEM_PROMPT = `You are an expert React and Tailwind CSS developer embedded in an AI website builder.

Your job is to generate complete, working React components based on user requests.

RULES:
1. Always respond with a complete React component wrapped in a single \`\`\`jsx code block.
2. Use Tailwind CSS for all styling (it is loaded via CDN — no imports needed).
3. The component MUST be a default export named App: \`export default function App() { ... }\`
4. Do not import React — it is already available globally.
5. Do not use TypeScript — write plain JavaScript JSX.
6. Do not use external libraries or npm imports — only React hooks and Tailwind.
7. Make the component visually polished, modern, and responsive.
8. Before the code block, write 1-2 sentences explaining what you built.
9. After generating code, you may suggest improvements or ask follow-up questions.

AVAILABLE:
- React hooks: useState, useEffect, useRef, useCallback, useMemo
- Tailwind CSS (full utility set)
- Inline SVG icons

EXAMPLE RESPONSE FORMAT:
Here's a modern hero section with a gradient background and call-to-action buttons.

\`\`\`jsx
export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-6xl font-bold mb-4">Hello World</h1>
        <button className="bg-white text-indigo-900 px-8 py-3 rounded-full font-semibold hover:scale-105 transition-transform">
          Get Started
        </button>
      </div>
    </div>
  )
}
\`\`\`
`

export function buildMessages({ userMessage, history, projectContext }: BuildMessagesOptions): Message[] {
  const systemContent = projectContext
    ? `${SYSTEM_PROMPT}\n\nCURRENT PAGE STATE (JSON component tree — use this to understand what's already built):\n${projectContext}`
    : SYSTEM_PROMPT

  return [
    { role: 'system', content: systemContent },
    ...history,
    { role: 'user', content: userMessage },
  ]
}
```

- [ ] **Step 3: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/ai" && pnpm test
```

Expected: 21 tests PASS.

- [ ] **Step 4: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add ai/src/orchestrator/
git commit -m "feat: context builder with React+Tailwind system prompt"
```

---

## Task 5: Code Extractor + Validator

**Files:**
- Create: `ai/src/orchestrator/codeExtractor.ts`
- Create: `ai/src/orchestrator/__tests__/codeExtractor.test.ts`

Extracts the last JSX/TSX/JS code block from the AI's accumulated response. Validates for dangerous patterns. Returns null if no code found.

- [ ] **Step 1: Write failing tests**

Create `ai/src/orchestrator/__tests__/codeExtractor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { extractCode, isDangerous } from '../codeExtractor.js'

describe('extractCode', () => {
  it('extracts jsx code block', () => {
    const text = 'Here is the component:\n\n```jsx\nexport default function App() { return <div>hi</div> }\n```'
    expect(extractCode(text)).toBe('export default function App() { return <div>hi</div> }')
  })

  it('extracts js code block', () => {
    const text = '```js\nexport default function App() { return <div /> }\n```'
    expect(extractCode(text)).toBe('export default function App() { return <div /> }')
  })

  it('returns last code block when multiple exist', () => {
    const text = '```jsx\nfirst()\n```\nsome text\n```jsx\nsecond()\n```'
    expect(extractCode(text)).toBe('second()')
  })

  it('returns null when no code block found', () => {
    expect(extractCode('no code here')).toBeNull()
  })

  it('returns null for empty code block', () => {
    expect(extractCode('```jsx\n\n```')).toBeNull()
  })
})

describe('isDangerous', () => {
  it('flags eval()', () => {
    expect(isDangerous('eval("code")')).toBe(true)
  })

  it('flags document.write', () => {
    expect(isDangerous('document.write("xss")')).toBe(true)
  })

  it('flags innerHTML assignment', () => {
    expect(isDangerous('el.innerHTML = userInput')).toBe(true)
  })

  it('passes safe code', () => {
    expect(isDangerous('export default function App() { return <div>safe</div> }')).toBe(false)
  })
})
```

```bash
cd "i:/VS Code/Website_Bulder/ai" && pnpm test
```

Expected: FAIL — functions not defined.

- [ ] **Step 2: Create ai/src/orchestrator/codeExtractor.ts**

```typescript
// Matches ```jsx, ```tsx, ```js, ```javascript, ```typescript code blocks
const CODE_BLOCK_RE = /```(?:jsx?|tsx?|javascript|typescript)\n([\s\S]*?)```/g

const DANGEROUS_PATTERNS = [
  /\beval\s*\(/,
  /\bdocument\.write\s*\(/,
  /\.innerHTML\s*=/,
  /\.outerHTML\s*=/,
  /\bwindow\.location\s*=/,
  /\bimport\s*\(/,           // dynamic import (could load external code)
  /require\s*\(/,             // CommonJS require
]

/** Extract the last code block from AI response text. Returns null if none found. */
export function extractCode(text: string): string | null {
  const matches = [...text.matchAll(CODE_BLOCK_RE)]
  if (matches.length === 0) return null

  const last = matches[matches.length - 1]
  const code = last[1].trim()
  return code.length > 0 ? code : null
}

/** Returns true if the code contains dangerous patterns that should not run in Sandpack. */
export function isDangerous(code: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(code))
}
```

- [ ] **Step 3: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/ai" && pnpm test
```

Expected: 30 tests PASS.

- [ ] **Step 4: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add ai/src/orchestrator/codeExtractor.ts ai/src/orchestrator/__tests__/codeExtractor.test.ts
git commit -m "feat: code extractor + dangerous pattern validator"
```

---

## Task 6: AI Orchestrator + Update Chat Route

**Files:**
- Create: `ai/src/orchestrator/index.ts`
- Modify: `ai/src/routes/chat.ts`
- Modify: `ai/src/routes/providers.ts`

The orchestrator: resolves adapter → builds messages → streams → accumulates response → extracts code → emits preview_update. Retries up to 3 times if code is invalid.

- [ ] **Step 1: Create ai/src/orchestrator/index.ts**

```typescript
import type { Response } from 'express'
import { buildAdapter, type ProviderConfig } from '../adapters/registry.js'
import { buildMessages } from './contextBuilder.js'
import { extractCode, isDangerous } from './codeExtractor.js'

export interface OrchestratorRequest {
  projectId: string
  message: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  providerConfig?: ProviderConfig
  projectContext?: string
}

function sendEvent(res: Response, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

/** Run the AI orchestration pipeline, streaming SSE events to res. */
export async function orchestrate(req: OrchestratorRequest, res: Response, maxRetries = 3): Promise<void> {
  const adapter = req.providerConfig
    ? buildAdapter(req.providerConfig)
    : buildAdapter({ provider: 'ollama' }) // uses env default

  const available = await adapter.isAvailable()
  if (!available) {
    sendEvent(res, { type: 'error', message: `Provider "${adapter.name}" is not reachable` })
    return
  }

  let attempt = 0
  let lastError = ''

  while (attempt < maxRetries) {
    attempt++

    const userMessage = attempt === 1
      ? req.message
      : `${req.message}\n\n[Previous attempt failed: ${lastError}. Please provide a valid React component in a \`\`\`jsx code block.]`

    const messages = buildMessages({
      userMessage,
      history: req.history,
      projectContext: req.projectContext,
    })

    let accumulated = ''

    try {
      for await (const chunk of adapter.stream({ messages, model: req.providerConfig?.model ?? '' })) {
        if (chunk.type === 'text_delta') {
          accumulated += chunk.content
          sendEvent(res, chunk)
        } else if (chunk.type === 'error') {
          sendEvent(res, chunk)
          return
        } else if (chunk.type === 'done') {
          break
        }
      }
    } catch (err) {
      sendEvent(res, { type: 'error', message: String(err) })
      return
    }

    // Extract code from accumulated response
    const code = extractCode(accumulated)

    if (!code) {
      lastError = 'No code block found in response'
      if (attempt < maxRetries) continue
      // Final attempt — no code found, just emit done without preview_update
      sendEvent(res, { type: 'done' })
      return
    }

    if (isDangerous(code)) {
      lastError = 'Generated code contains unsafe patterns'
      if (attempt < maxRetries) continue
      sendEvent(res, { type: 'error', message: 'Generated code contains unsafe patterns and was blocked' })
      return
    }

    // Valid code — emit preview update then done
    sendEvent(res, { type: 'preview_update', code })
    sendEvent(res, { type: 'done' })
    return
  }
}
```

- [ ] **Step 2: Modify ai/src/routes/chat.ts to use orchestrator**

Replace the entire file:

```typescript
import { Router, type Request, type Response } from 'express'
import { chatRequestSchema } from '@ai-builder/shared'
import { orchestrate } from '../orchestrator/index.js'

export const chatRouter = Router()

chatRouter.post('/stream', async (req: Request, res: Response) => {
  const parsed = chatRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const { projectId, message, history, providerConfig, projectContext } = parsed.data

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  await orchestrate({ projectId, message, history, providerConfig, projectContext }, res)
  res.end()
})
```

- [ ] **Step 3: Modify ai/src/routes/providers.ts to use registry**

Replace entire file:

```typescript
import { Router } from 'express'
import { buildAdapter, buildDefaultAdapter } from '../adapters/registry.js'
import type { ProviderConfig } from '../adapters/registry.js'

export const providersRouter = Router()

providersRouter.get('/health', async (_req, res) => {
  const adapter = buildDefaultAdapter()
  const available = await adapter.isAvailable()
  res.json({ [adapter.name]: { available } })
})

providersRouter.post('/health', async (req, res) => {
  const cfg = req.body as Partial<ProviderConfig>
  if (!cfg.provider) return res.status(400).json({ error: 'provider required' })
  const adapter = buildAdapter(cfg as ProviderConfig)
  const available = await adapter.isAvailable()
  res.json({ provider: adapter.name, available })
})

providersRouter.get('/models', async (_req, res) => {
  const adapter = buildDefaultAdapter()
  const models = await adapter.listModels()
  res.json({ models })
})

providersRouter.post('/models', async (req, res) => {
  const cfg = req.body as Partial<ProviderConfig>
  if (!cfg.provider) return res.status(400).json({ error: 'provider required' })
  const adapter = buildAdapter(cfg as ProviderConfig)
  const models = await adapter.listModels()
  res.json({ models })
})
```

- [ ] **Step 4: Run all tests**

```bash
cd "i:/VS Code/Website_Bulder/ai" && pnpm test
```

Expected: 30 tests PASS (orchestrator has no unit tests — it's integration-level; covered by smoke test in Task 12).

- [ ] **Step 5: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add ai/src/orchestrator/index.ts ai/src/routes/chat.ts ai/src/routes/providers.ts
git commit -m "feat: AI orchestrator with retry logic and preview_update emission"
```

---

## Task 7: Encryption Utilities (Web)

**Files:**
- Create: `web/src/lib/encryption.ts`
- Create: `web/src/lib/__tests__/encryption.test.ts`

AES-256-GCM encrypt/decrypt using Node.js `crypto`. Keys stored in `aiProviderConfigs.apiKey` are always encrypted.

- [ ] **Step 1: Write failing test**

Create `web/src/lib/__tests__/encryption.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../encryption'

const SECRET = 'a'.repeat(32) // 32-byte key for testing

describe('encryption', () => {
  it('round-trips a string', () => {
    const plaintext = 'sk-my-secret-api-key-12345'
    const encrypted = encrypt(plaintext, SECRET)
    expect(decrypt(encrypted, SECRET)).toBe(plaintext)
  })

  it('produces different ciphertext each time (random IV)', () => {
    const encrypted1 = encrypt('same', SECRET)
    const encrypted2 = encrypt('same', SECRET)
    expect(encrypted1).not.toBe(encrypted2)
  })

  it('returns null for empty string', () => {
    expect(encrypt('', SECRET)).toBeNull()
  })

  it('decrypt returns null for tampered data', () => {
    const encrypted = encrypt('hello', SECRET)!
    const tampered = encrypted.slice(0, -4) + 'xxxx'
    expect(decrypt(tampered, SECRET)).toBeNull()
  })
})
```

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: FAIL — `encrypt` not defined.

- [ ] **Step 2: Create web/src/lib/encryption.ts**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // GCM standard
const TAG_LENGTH = 16

/** Encrypt plaintext with AES-256-GCM. Returns base64 string or null for empty input. */
export function encrypt(plaintext: string, secret: string): string | null {
  if (!plaintext) return null
  const key = Buffer.from(secret.padEnd(32, '0').slice(0, 32))
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv(12) + tag(16) + ciphertext — all base64
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/** Decrypt AES-256-GCM ciphertext. Returns null on failure. */
export function decrypt(ciphertext: string, secret: string): string | null {
  try {
    const buf = Buffer.from(ciphertext, 'base64')
    const key = Buffer.from(secret.padEnd(32, '0').slice(0, 32))
    const iv = buf.subarray(0, IV_LENGTH)
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH)
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(encrypted) + decipher.final('utf8')
  } catch {
    return null
  }
}

/** Get the encryption secret from env. Throws if not set in production. */
export function getEncryptionSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET ?? ''
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_SECRET env var is required in production')
  }
  return secret || 'dev-secret-do-not-use-in-prod-xx'
}
```

- [ ] **Step 3: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 8 tests PASS (5 old + 3 new encryption — note: empty string test: `encrypt('', SECRET)` returns null so that's 1 test).

Wait — count: 4 encryption tests total. Expected: 5 old + 4 new = 9 tests PASS.

- [ ] **Step 4: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/lib/encryption.ts web/src/lib/__tests__/encryption.test.ts
git commit -m "feat: AES-256-GCM encryption for API keys"
```

---

## Task 8: Credit Gate (Web)

**Files:**
- Create: `web/src/lib/credits.ts`
- Create: `web/src/lib/__tests__/credits.test.ts`

Functions to check, deduct, and refund credits atomically using Drizzle.

- [ ] **Step 1: Write failing tests**

Create `web/src/lib/__tests__/credits.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../schema'
import { hasCredits, deductCredits, refundCredits } from '../credits'
import path from 'path'

function testDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') })
  return db
}

describe('credit gate', () => {
  let db: ReturnType<typeof testDb>

  beforeAll(() => {
    db = testDb()
    db.insert(schema.users).values({ id: 'u1', email: 'a@b.com', credits: 10 }).run()
  })

  it('hasCredits returns true when balance >= cost', () => {
    expect(hasCredits(db, 'u1', 5)).toBe(true)
  })

  it('hasCredits returns true when cost is 0', () => {
    expect(hasCredits(db, 'u1', 0)).toBe(true)
  })

  it('hasCredits returns false when balance < cost', () => {
    expect(hasCredits(db, 'u1', 100)).toBe(false)
  })

  it('deductCredits reduces balance and creates transaction', () => {
    deductCredits(db, 'u1', 3, 'test deduction')
    const user = db.select().from(schema.users).where((u, { eq }) => eq(u.id, 'u1')).get()
    expect(user?.credits).toBe(7)
  })

  it('refundCredits increases balance and creates transaction', () => {
    refundCredits(db, 'u1', 2, 'test refund')
    const user = db.select().from(schema.users).where((u, { eq }) => eq(u.id, 'u1')).get()
    expect(user?.credits).toBe(9)
  })
})
```

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: FAIL — `hasCredits` not defined.

- [ ] **Step 2: Create web/src/lib/credits.ts**

```typescript
import { eq, sql } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { generateId } from './utils'

type DB = BetterSQLite3Database<typeof schema>

/** Check if user has enough credits. Cost 0 always passes (local models). */
export function hasCredits(db: DB, userId: string, cost: number): boolean {
  if (cost === 0) return true
  const user = db.select({ credits: schema.users.credits })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get()
  return (user?.credits ?? 0) >= cost
}

/** Deduct credits from user balance and record a transaction. */
export function deductCredits(db: DB, userId: string, amount: number, description: string): void {
  if (amount === 0) return
  db.update(schema.users)
    .set({ credits: sql`${schema.users.credits} - ${amount}` })
    .where(eq(schema.users.id, userId))
    .run()
  db.insert(schema.creditTransactions).values({
    id: generateId(),
    userId,
    amount: -amount,
    type: 'usage',
    description,
  }).run()
}

/** Refund credits to user balance and record a transaction. */
export function refundCredits(db: DB, userId: string, amount: number, description: string): void {
  if (amount === 0) return
  db.update(schema.users)
    .set({ credits: sql`${schema.users.credits} + ${amount}` })
    .where(eq(schema.users.id, userId))
    .run()
  db.insert(schema.creditTransactions).values({
    id: generateId(),
    userId,
    amount,
    type: 'refund',
    description,
  }).run()
}
```

- [ ] **Step 3: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 14 tests PASS.

- [ ] **Step 4: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/lib/credits.ts web/src/lib/__tests__/credits.test.ts
git commit -m "feat: credit gate — hasCredits, deductCredits, refundCredits"
```

---

## Task 9: DB Seed + Provider Config APIs

**Files:**
- Create: `web/src/lib/seed.ts`
- Create: `web/src/app/api/providers/route.ts`
- Create: `web/src/app/api/providers/[id]/route.ts`
- Create: `web/src/app/api/admin/providers/route.ts`
- Create: `web/src/app/api/admin/providers/[id]/route.ts`
- Modify: `web/src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create web/src/lib/seed.ts**

Seeds the default Ollama platform provider if none exists.

```typescript
import { eq } from 'drizzle-orm'
import { db } from './db'
import { aiProviderConfigs } from './schema'
import { generateId } from './utils'

export function seedDefaultProviders(): void {
  const existing = db.select().from(aiProviderConfigs)
    .where(eq(aiProviderConfigs.scope, 'platform'))
    .get()

  if (existing) return // already seeded

  const ollamaUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
  const defaultModel = process.env.DEFAULT_MODEL ?? 'llama3.2'

  db.insert(aiProviderConfigs).values({
    id: generateId(),
    scope: 'platform',
    provider: 'ollama',
    displayName: 'Ollama (Local)',
    baseUrl: ollamaUrl,
    model: defaultModel,
    isDefault: true,
    isActive: true,
    allowedPlans: JSON.stringify(['free', 'pro', 'enterprise']),
    creditCostPerRequest: 0,
  }).run()
}
```

- [ ] **Step 2: Add seed import to auth route**

Modify `web/src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import '@/lib/migrate'
import '@/lib/seed'  // add this line
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

// Also add the seed call:
import { seedDefaultProviders } from '@/lib/seed'
seedDefaultProviders()

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

Wait — import side effects run once; calling `seedDefaultProviders()` directly is cleaner. Replace the entire file:

```typescript
import '@/lib/migrate'
import { seedDefaultProviders } from '@/lib/seed'
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

seedDefaultProviders()

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 3: Create web/src/lib/providerResolver.ts**

Resolves the best available provider config for a user (user-owned first, then platform).

```typescript
import { and, eq } from 'drizzle-orm'
import { db } from './db'
import { aiProviderConfigs } from './schema'
import { decrypt, getEncryptionSecret } from './encryption'

export interface ResolvedProvider {
  provider: string
  baseUrl?: string
  apiKey?: string
  model?: string
  creditCost: number
}

export function resolveProvider(userId: string, userPlan: string, preferredProvider?: string): ResolvedProvider | null {
  const secret = getEncryptionSecret()

  // 1. User's own configs
  const userConfigs = db.select().from(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.scope, 'user'), eq(aiProviderConfigs.userId, userId), eq(aiProviderConfigs.isActive, true)))
    .all()

  const userDefault = userConfigs.find(c => preferredProvider ? c.provider === preferredProvider : c.isDefault)
    ?? userConfigs[0]

  if (userDefault) {
    return {
      provider: userDefault.provider,
      baseUrl: userDefault.baseUrl ?? undefined,
      apiKey: userDefault.apiKey ? (decrypt(userDefault.apiKey, secret) ?? undefined) : undefined,
      model: userDefault.model ?? undefined,
      creditCost: userDefault.creditCostPerRequest,
    }
  }

  // 2. Platform providers accessible to user's plan
  const platformConfigs = db.select().from(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.scope, 'platform'), eq(aiProviderConfigs.isActive, true)))
    .all()

  const eligible = platformConfigs.filter(c => {
    const plans = JSON.parse(c.allowedPlans as string) as string[]
    return plans.includes(userPlan)
  })

  const platformDefault = eligible.find(c => preferredProvider ? c.provider === preferredProvider : c.isDefault)
    ?? eligible[0]

  if (platformDefault) {
    return {
      provider: platformDefault.provider,
      baseUrl: platformDefault.baseUrl ?? undefined,
      apiKey: platformDefault.apiKey ? (decrypt(platformDefault.apiKey, secret) ?? undefined) : undefined,
      model: platformDefault.model ?? undefined,
      creditCost: platformDefault.creditCostPerRequest,
    }
  }

  return null
}
```

- [ ] **Step 4: Create user provider config API routes**

Create `web/src/app/api/providers/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { aiProviderConfigs } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { upsertProviderConfigSchema } from '@ai-builder/shared'
import { generateId } from '@/lib/utils'
import { encrypt, getEncryptionSecret } from '@/lib/encryption'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const configs = db.select({
    id: aiProviderConfigs.id,
    provider: aiProviderConfigs.provider,
    displayName: aiProviderConfigs.displayName,
    baseUrl: aiProviderConfigs.baseUrl,
    model: aiProviderConfigs.model,
    isDefault: aiProviderConfigs.isDefault,
    isActive: aiProviderConfigs.isActive,
    creditCostPerRequest: aiProviderConfigs.creditCostPerRequest,
    // Never return apiKey to client
  }).from(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.scope, 'user'), eq(aiProviderConfigs.userId, session.user.id)))
    .all()

  return NextResponse.json({ configs })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = upsertProviderConfigSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { provider, displayName, baseUrl, apiKey, model, isDefault, allowedPlans, creditCostPerRequest } = parsed.data
  const secret = getEncryptionSecret()

  const id = generateId()
  db.insert(aiProviderConfigs).values({
    id,
    scope: 'user',
    userId: session.user.id,
    provider,
    displayName,
    baseUrl: baseUrl || null,
    apiKey: apiKey ? encrypt(apiKey, secret) : null,
    model: model || null,
    isDefault: isDefault ?? false,
    isActive: true,
    allowedPlans: JSON.stringify(allowedPlans),
    creditCostPerRequest: creditCostPerRequest ?? 0,
  }).run()

  return NextResponse.json({ id }, { status: 201 })
}
```

Create `web/src/app/api/providers/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { aiProviderConfigs } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { upsertProviderConfigSchema } from '@ai-builder/shared'
import { encrypt, getEncryptionSecret } from '@/lib/encryption'

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = db.select().from(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.id, params.id), eq(aiProviderConfigs.userId, session.user.id)))
    .get()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = upsertProviderConfigSchema.partial().safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const secret = getEncryptionSecret()
  const updates: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.apiKey !== undefined) {
    updates.apiKey = parsed.data.apiKey ? encrypt(parsed.data.apiKey, secret) : null
  }
  if (parsed.data.allowedPlans !== undefined) {
    updates.allowedPlans = JSON.stringify(parsed.data.allowedPlans)
  }

  db.update(aiProviderConfigs).set(updates).where(eq(aiProviderConfigs.id, params.id)).run()
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  db.delete(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.id, params.id), eq(aiProviderConfigs.userId, session.user.id)))
    .run()
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 5: Create admin provider config API routes**

Create `web/src/app/api/admin/providers/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { aiProviderConfigs } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { upsertProviderConfigSchema } from '@ai-builder/shared'
import { generateId } from '@/lib/utils'
import { encrypt, getEncryptionSecret } from '@/lib/encryption'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  if (session.user.role !== 'admin') return null
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const configs = db.select({
    id: aiProviderConfigs.id,
    provider: aiProviderConfigs.provider,
    displayName: aiProviderConfigs.displayName,
    baseUrl: aiProviderConfigs.baseUrl,
    model: aiProviderConfigs.model,
    isDefault: aiProviderConfigs.isDefault,
    isActive: aiProviderConfigs.isActive,
    allowedPlans: aiProviderConfigs.allowedPlans,
    creditCostPerRequest: aiProviderConfigs.creditCostPerRequest,
    createdAt: aiProviderConfigs.createdAt,
    // never return apiKey
  }).from(aiProviderConfigs)
    .where(eq(aiProviderConfigs.scope, 'platform'))
    .all()

  return NextResponse.json({ configs })
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = upsertProviderConfigSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const secret = getEncryptionSecret()
  const { provider, displayName, baseUrl, apiKey, model, isDefault, allowedPlans, creditCostPerRequest } = parsed.data

  const id = generateId()
  db.insert(aiProviderConfigs).values({
    id,
    scope: 'platform',
    provider,
    displayName,
    baseUrl: baseUrl || null,
    apiKey: apiKey ? encrypt(apiKey, secret) : null,
    model: model || null,
    isDefault: isDefault ?? false,
    isActive: true,
    allowedPlans: JSON.stringify(allowedPlans),
    creditCostPerRequest: creditCostPerRequest ?? 0,
  }).run()

  return NextResponse.json({ id }, { status: 201 })
}
```

Create `web/src/app/api/admin/providers/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { aiProviderConfigs } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { upsertProviderConfigSchema } from '@ai-builder/shared'
import { encrypt, getEncryptionSecret } from '@/lib/encryption'

type Params = { params: { id: string } }

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') return null
  return session
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const existing = db.select().from(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.id, params.id), eq(aiProviderConfigs.scope, 'platform')))
    .get()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = upsertProviderConfigSchema.partial().safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const secret = getEncryptionSecret()
  const updates: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.apiKey !== undefined) {
    updates.apiKey = parsed.data.apiKey ? encrypt(parsed.data.apiKey, secret) : null
  }
  if (parsed.data.allowedPlans !== undefined) {
    updates.allowedPlans = JSON.stringify(parsed.data.allowedPlans)
  }

  db.update(aiProviderConfigs).set(updates).where(eq(aiProviderConfigs.id, params.id)).run()
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  db.delete(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.id, params.id), eq(aiProviderConfigs.scope, 'platform')))
    .run()
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 6: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 14 tests PASS (no new tests — API routes are integration-level).

- [ ] **Step 7: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/lib/seed.ts web/src/lib/providerResolver.ts \
  web/src/app/api/auth/ web/src/app/api/providers/ web/src/app/api/admin/
git commit -m "feat: provider config APIs, seed, resolver"
```

---

## Task 10: Chat Session Persistence + Updated Stream Proxy

**Files:**
- Create: `web/src/app/api/chat-sessions/[projectId]/route.ts`
- Create: `web/src/app/api/ai/complete/route.ts`
- Modify: `web/src/app/api/ai/stream/route.ts`

The stream proxy now: resolves provider → loads history → checks credits → proxies. The `/api/ai/complete` endpoint deducts credits after the browser receives `done`.

- [ ] **Step 1: Create chat session API**

Create `web/src/app/api/chat-sessions/[projectId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { chatSessions, pages } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

type Params = { params: { projectId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const chatSession = db.select().from(chatSessions)
    .where(and(eq(chatSessions.projectId, params.projectId), eq(chatSessions.userId, session.user.id)))
    .get()

  return NextResponse.json({
    messages: chatSession ? (chatSession.messages as unknown[]) : [],
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, provider, model } = await req.json() as {
    messages: Array<{ role: string; content: string; timestamp: number }>
    provider?: string
    model?: string
  }

  const existing = db.select().from(chatSessions)
    .where(and(eq(chatSessions.projectId, params.projectId), eq(chatSessions.userId, session.user.id)))
    .get()

  if (existing) {
    db.update(chatSessions).set({
      messages: JSON.stringify(messages),
      provider: provider ?? existing.provider,
      model: model ?? existing.model,
      updatedAt: new Date(),
    }).where(eq(chatSessions.id, existing.id)).run()
  } else {
    db.insert(chatSessions).values({
      id: generateId(),
      projectId: params.projectId,
      userId: session.user.id,
      messages: JSON.stringify(messages),
      provider: provider ?? null,
      model: model ?? null,
    }).run()
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Create ai complete endpoint**

Create `web/src/app/api/ai/complete/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { deductCredits } from '@/lib/credits'
import { z } from 'zod'

const completeSchema = z.object({
  creditCost: z.number().int().min(0),
  description: z.string().default('AI generation'),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = completeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  deductCredits(db, session.user.id, parsed.data.creditCost, parsed.data.description)
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Replace web/src/app/api/ai/stream/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { pages, chatSessions } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { resolveProvider } from '@/lib/providerResolver'
import { hasCredits } from '@/lib/credits'

const AI_INTERNAL_URL = process.env.AI_SERVICE_INTERNAL_URL ?? 'http://localhost:4001'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    projectId: string
    message: string
    provider?: string
  }

  const { projectId, message, provider: preferredProvider } = body

  // Resolve provider config for this user
  const resolved = resolveProvider(session.user.id, session.user.plan, preferredProvider)
  if (!resolved) {
    return NextResponse.json(
      { error: 'No AI provider configured. Ask your admin to set up a provider.' },
      { status: 503 },
    )
  }

  // Credit gate: pre-check
  if (!hasCredits(db, session.user.id, resolved.creditCost)) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
  }

  // Load chat history
  const chatSession = db.select().from(chatSessions)
    .where(and(eq(chatSessions.projectId, projectId), eq(chatSessions.userId, session.user.id)))
    .get()
  const history = chatSession ? (chatSession.messages as Array<{ role: 'user' | 'assistant'; content: string }>) : []

  // Load project context (home page content)
  const homePage = db.select({ content: pages.content }).from(pages)
    .where(and(eq(pages.projectId, projectId), eq(pages.isHomePage, true)))
    .get()
  const projectContext = homePage?.content ? JSON.stringify(homePage.content) : undefined

  // Build request for AI service
  const aiRequest = {
    projectId,
    message,
    history,
    providerConfig: {
      provider: resolved.provider,
      baseUrl: resolved.baseUrl,
      apiKey: resolved.apiKey,
      model: resolved.model,
    },
    projectContext,
  }

  // Proxy to AI service
  const aiRes = await fetch(`${AI_INTERNAL_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(aiRequest),
  })

  if (!aiRes.ok || !aiRes.body) {
    return NextResponse.json({ error: 'AI service error' }, { status: 502 })
  }

  return new NextResponse(aiRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      // Pass credit cost to browser so it can call /api/ai/complete
      'X-Credit-Cost': String(resolved.creditCost),
    },
  })
}
```

- [ ] **Step 4: Update ChatPanel.tsx to save session + call complete**

Modify `web/src/components/builder/ChatPanel.tsx`. Replace the `sendMessage` function body:

```typescript
async function sendMessage() {
  const content = input.trim()
  if (!content || streaming || !project) return

  const newUserMsg = { role: 'user' as const, content, timestamp: Date.now() }
  setInput('')
  addMessage(newUserMsg)
  setStreaming(true)

  try {
    const res = await fetch('/api/ai/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, message: content }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Stream failed' }))
      addMessage({ role: 'assistant', content: `Error: ${err.error}`, timestamp: Date.now() })
      setStreaming(false)
      return
    }

    const creditCost = parseInt(res.headers.get('X-Credit-Cost') ?? '0', 10)
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let success = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const lines = decoder.decode(value, { stream: true })
        .split('\n')
        .filter(l => l.startsWith('data: '))

      for (const line of lines) {
        try {
          const event = JSON.parse(line.slice(6))
          if (event.type === 'text_delta') {
            appendStreamingContent(event.content)
          } else if (event.type === 'preview_update') {
            setPreviewCode(event.code)
          } else if (event.type === 'done') {
            success = true
            finalizeStreamingMessage()
          } else if (event.type === 'error') {
            finalizeStreamingMessage()
          }
        } catch { /* skip malformed */ }
      }
    }

    // Deduct credits after successful stream
    if (success && creditCost > 0) {
      fetch('/api/ai/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditCost, description: `AI generation for project ${project.id}` }),
      }).catch(() => {}) // fire and forget
    }

    // Save chat session (fire and forget)
    const updatedMessages = [...messages, newUserMsg]
    fetch(`/api/chat-sessions/${project.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: updatedMessages }),
    }).catch(() => {})

  } catch {
    finalizeStreamingMessage()
  }
}
```

Also add `import { useChatStore } from '@/store/chatStore'` destructuring to include `messages` from the store if not already included.

- [ ] **Step 5: Run all web tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 14 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/app/api/chat-sessions/ web/src/app/api/ai/ web/src/components/builder/ChatPanel.tsx
git commit -m "feat: chat session persistence, stream proxy with credit gate"
```

---

## Task 11: Admin Provider Management UI

**Files:**
- Create: `web/src/app/admin/providers/page.tsx`
- Create: `web/src/app/admin/providers/AdminProvidersClient.tsx`

- [ ] **Step 1: Create admin providers page (server component)**

Create `web/src/app/admin/providers/page.tsx`:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminProvidersClient from './AdminProvidersClient'

export default async function AdminProvidersPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'admin') redirect('/dashboard')

  return <AdminProvidersClient />
}
```

- [ ] **Step 2: Create AdminProvidersClient.tsx**

Create `web/src/app/admin/providers/AdminProvidersClient.tsx`:

```typescript
'use client'
import { useEffect, useState } from 'react'

interface ProviderConfig {
  id: string
  provider: string
  displayName: string
  baseUrl: string | null
  model: string | null
  isDefault: boolean
  isActive: boolean
  allowedPlans: string
  creditCostPerRequest: number
}

const PROVIDERS = ['ollama', 'lmstudio', 'openai', 'claude', 'gemini', 'openrouter', 'custom'] as const

export default function AdminProvidersClient() {
  const [configs, setConfigs] = useState<ProviderConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    provider: 'ollama',
    displayName: '',
    baseUrl: '',
    apiKey: '',
    model: '',
    isDefault: false,
    allowedPlans: ['free', 'pro', 'enterprise'],
    creditCostPerRequest: 0,
  })
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/admin/providers')
    const data = await res.json()
    setConfigs(data.configs ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    await fetch('/api/admin/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setShowForm(false)
    setForm({ provider: 'ollama', displayName: '', baseUrl: '', apiKey: '', model: '', isDefault: false, allowedPlans: ['free', 'pro', 'enterprise'], creditCostPerRequest: 0 })
    load()
  }

  async function toggle(id: string, isActive: boolean) {
    await fetch(`/api/admin/providers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this provider?')) return
    await fetch(`/api/admin/providers/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Admin — AI Providers</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add Provider
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {showForm && (
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">New Platform Provider</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Provider</label>
                <select
                  value={form.provider}
                  onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Display Name</label>
                <input
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ollama (Local LAN)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Base URL</label>
                <input
                  value={form.baseUrl}
                  onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="http://192.168.1.x:11434"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">API Key (optional)</label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Model</label>
                <input
                  value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="llama3.2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Credit cost per request</label>
                <input
                  type="number"
                  min={0}
                  value={form.creditCostPerRequest}
                  onChange={e => setForm(f => ({ ...f, creditCostPerRequest: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={form.isDefault}
                onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
              />
              <label htmlFor="isDefault" className="text-sm text-foreground">Set as platform default</label>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !form.displayName}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving…' : 'Save Provider'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : configs.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No platform providers configured.</p>
        ) : (
          <div className="space-y-3">
            {configs.map(cfg => (
              <div key={cfg.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground text-sm">{cfg.displayName}</span>
                    {cfg.isDefault && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">default</span>}
                    {!cfg.isActive && <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded">inactive</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {cfg.provider} · {cfg.model ?? 'default model'} · {cfg.creditCostPerRequest} credits/req
                  </div>
                  {cfg.baseUrl && <div className="text-xs text-muted-foreground">{cfg.baseUrl}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggle(cfg.id, cfg.isActive)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {cfg.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => remove(cfg.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/app/admin/
git commit -m "feat: admin provider management UI"
```

---

## Task 12: User Provider Settings UI

**Files:**
- Create: `web/src/app/settings/providers/page.tsx`
- Create: `web/src/app/settings/providers/ProvidersClient.tsx`
- Modify: `web/src/app/dashboard/DashboardClient.tsx` (add nav link to settings)

- [ ] **Step 1: Create settings providers page**

Create `web/src/app/settings/providers/page.tsx`:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ProvidersClient from './ProvidersClient'

export default async function SettingsProvidersPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  return <ProvidersClient user={session.user} />
}
```

- [ ] **Step 2: Create ProvidersClient.tsx**

Create `web/src/app/settings/providers/ProvidersClient.tsx`:

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ProviderConfig {
  id: string
  provider: string
  displayName: string
  baseUrl: string | null
  model: string | null
  isDefault: boolean
  isActive: boolean
}

const PROVIDERS = ['ollama', 'lmstudio', 'openai', 'claude', 'gemini', 'openrouter', 'custom'] as const

interface Props {
  user: { name: string | null; email: string; credits: number; plan: string }
}

export default function ProvidersClient({ user }: Props) {
  const router = useRouter()
  const [configs, setConfigs] = useState<ProviderConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    provider: 'openai',
    displayName: '',
    baseUrl: '',
    apiKey: '',
    model: '',
    isDefault: false,
  })
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/providers')
    const data = await res.json()
    setConfigs(data.configs ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    await fetch('/api/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, allowedPlans: ['free', 'pro', 'enterprise'] }),
    })
    setSaving(false)
    setShowForm(false)
    setForm({ provider: 'openai', displayName: '', baseUrl: '', apiKey: '', model: '', isDefault: false })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Remove this provider?')) return
    await fetch(`/api/providers/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          ← Dashboard
        </button>
        <h1 className="text-xl font-bold text-foreground">My AI Providers</h1>
        <div className="ml-auto text-sm text-muted-foreground">{user.credits} credits · {user.plan}</div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Add your own API keys to use your own LLM quota instead of platform providers.
          </p>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + Add Key
          </button>
        </div>

        {showForm && (
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-foreground">Add API Key</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Provider</label>
                <select
                  value={form.provider}
                  onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                <input
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="My OpenAI"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">API Key</label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Base URL (optional)</label>
                <input
                  value={form.baseUrl}
                  onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://api.openai.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Model</label>
                <input
                  value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="gpt-4o-mini"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                onClick={save}
                disabled={saving || !form.displayName || !form.apiKey}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : configs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No personal providers added.</p>
            <p className="text-xs mt-1">Platform providers are used by default.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {configs.map(cfg => (
              <div key={cfg.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground text-sm">{cfg.displayName}</span>
                    {cfg.isDefault && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">default</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{cfg.provider} · {cfg.model ?? 'default model'}</div>
                </div>
                <button
                  onClick={() => remove(cfg.id)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Add Settings link to dashboard**

In `web/src/app/dashboard/DashboardClient.tsx`, inside the header, add a settings link after the credits display:

```typescript
import Link from 'next/link'

// In the header flex, after the credits span:
<Link href="/settings/providers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
  AI Settings
</Link>
```

- [ ] **Step 4: Update middleware to protect new routes**

In `web/src/middleware.ts`, update the matcher:

```typescript
export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/builder/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/api/projects/:path*',
    '/api/providers/:path*',
    '/api/admin/:path*',
    '/api/chat-sessions/:path*',
    '/api/ai/:path*',
  ],
}
```

- [ ] **Step 5: Run all tests**

```bash
cd "i:/VS Code/Website_Bulder"
pnpm test
```

Expected: all tests PASS (ai: 30, web: 14 = 44 total).

- [ ] **Step 6: Final commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/app/settings/ web/src/app/dashboard/DashboardClient.tsx web/src/middleware.ts
git commit -m "feat: user provider settings UI + middleware update"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ AI orchestrator — `ai/src/orchestrator/index.ts`
- ✅ Provider adapter layer (Ollama existing, LM Studio, OpenAI, Claude, OpenRouter) — Tasks 2-3
- ✅ SSE streaming pipeline — orchestrator + updated chat route + stream proxy
- ✅ Code validator + auto-fix (3 retries) — Tasks 4, 5 (regex-based extraction + retry loop)
- ✅ Project context memory — context builder + stream proxy passes page content
- ✅ Admin UI for platform providers — Task 11
- ✅ User UI for personal settings — Task 12
- ✅ Two-tier provider resolution — `web/src/lib/providerResolver.ts` in Task 9
- ✅ Credit gate (check → call → deduct/refund) — Tasks 7, 8, 10

**Type consistency:**
- `ProviderConfig` interface defined in `ai/src/adapters/registry.ts` and used in `orchestrator/index.ts` ✅
- `buildMessages` returns `Message[]` consumed by adapter `stream()` which takes `AIRequest.messages` ✅
- `chatRequestSchema.providerConfig` matches `ProviderConfig` interface ✅
- `resolveProvider` returns `ResolvedProvider` with fields mapped correctly into `aiRequest.providerConfig` in stream route ✅
- `hasCredits`, `deductCredits`, `refundCredits` all take same `db` type from `drizzle-orm/better-sqlite3` ✅

**Placeholder scan:** No TBDs, no "implement later", all code blocks are complete.

**Note on Gemini:** The spec mentions Gemini but the Google Generative AI SDK has a different streaming API. Adding a full Gemini adapter would require `@google/generative-ai` SDK. This is not included in Phase 2 — it's a YAGNI omission given Ollama + OpenAI covers the key use case. Gemini can be added in Phase 5.
