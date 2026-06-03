import type { Response } from 'express'
import { buildAdapter, buildDefaultAdapter, type ProviderConfig } from '../adapters/registry.js'
import { buildMessages } from './contextBuilder.js'
import { extractCode, isDangerous } from './codeExtractor.js'

export interface OrchestratorRequest {
  projectId: string
  message: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  providerConfig?: ProviderConfig
  projectContext?: string
  customInstructions?: string
  brandSettings?: { primaryColor?: string; fontFamily?: string; borderRadius?: 'sharp' | 'rounded' | 'pill'; navCode?: string }
}

function sendEvent(res: Response, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

export async function orchestrate(req: OrchestratorRequest, res: Response, maxRetries = 3): Promise<void> {
  const adapter = req.providerConfig
    ? buildAdapter(req.providerConfig)
    : buildDefaultAdapter()

  const available = await adapter.isAvailable()
  if (!available) {
    sendEvent(res, { type: 'error', message: `Provider "${adapter.name}" is not reachable` })
    return
  }

  let attempt = 0
  let lastError = ''

  while (attempt < maxRetries) {
    attempt++

    // On retry: append the error hint to the BASE message, not the full injected
    // message — contextBuilder will re-inject the current code around it
    const baseMessage = attempt === 1
      ? req.message
      : `${req.message}\n\n[Previous attempt failed: ${lastError}. Output the COMPLETE component — do not truncate or use placeholders.]`

    // Emit retry signal to the user
    if (attempt > 1) {
      sendEvent(res, { type: 'text_delta', content: '\n\n⚡ Refining the output…\n' })
    }

    const messages = buildMessages({
      userMessage: baseMessage,
      history: req.history,
      projectContext: req.projectContext,
      customInstructions: req.customInstructions,
      brandSettings: req.brandSettings,
      projectId: req.projectId,
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

    const code = extractCode(accumulated)

    if (!code) {
      lastError = 'No code block found in response'
      if (attempt < maxRetries) continue
      sendEvent(res, { type: 'done' })
      return
    }

    if (isDangerous(code)) {
      lastError = 'Generated code contains unsafe patterns'
      if (attempt < maxRetries) continue
      sendEvent(res, { type: 'error', message: 'Generated code contains unsafe patterns and was blocked' })
      return
    }

    sendEvent(res, { type: 'preview_update', code })
    sendEvent(res, { type: 'done' })
    return
  }
}
