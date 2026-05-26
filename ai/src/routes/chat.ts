import { Router, type Request, type Response } from 'express'
import { OllamaAdapter } from '../adapters/ollama.js'
import { config } from '../config.js'
import { chatRequestSchema } from '@ai-builder/shared'

export const chatRouter = Router()

const ollamaAdapter = new OllamaAdapter(config.ollamaBaseUrl, config.defaultModel)

chatRouter.post('/stream', async (req: Request, res: Response) => {
  const parsed = chatRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const { message, model } = parsed.data

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const available = await ollamaAdapter.isAvailable()
    if (!available) {
      sendEvent({ type: 'error', message: `Ollama unreachable at ${config.ollamaBaseUrl}` })
      return res.end()
    }

    const request = {
      messages: [{ role: 'user' as const, content: message }],
      model: model ?? config.defaultModel,
    }

    for await (const chunk of ollamaAdapter.stream(request)) {
      sendEvent(chunk)
      if (chunk.type === 'done' || chunk.type === 'error') break
    }
  } catch (err) {
    sendEvent({ type: 'error', message: String(err) })
  }

  res.end()
})
