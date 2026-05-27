import { Router, type Request, type Response } from 'express'
import { chatRequestSchema } from '@ai-builder/shared'
import { orchestrate } from '../orchestrator/index.js'

export const chatRouter = Router()

chatRouter.post('/stream', async (req: Request, res: Response) => {
  const parsed = chatRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const { projectId, message, history, providerConfig, projectContext, customInstructions } = parsed.data

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  await orchestrate({ projectId, message, history: history ?? [], providerConfig, projectContext, customInstructions }, res)
  res.end()
})
