import { Router } from 'express'
import { OllamaAdapter } from '../adapters/ollama.js'
import { config } from '../config.js'

export const providersRouter = Router()

const ollamaAdapter = new OllamaAdapter(config.ollamaBaseUrl, config.defaultModel)

providersRouter.get('/health', async (_req, res) => {
  const available = await ollamaAdapter.isAvailable()
  res.json({
    ollama: { available, baseUrl: config.ollamaBaseUrl },
  })
})

providersRouter.get('/models', async (_req, res) => {
  const available = await ollamaAdapter.isAvailable()
  if (!available) {
    return res.json({ models: [] })
  }
  const models = await ollamaAdapter.listModels()
  res.json({ models })
})
