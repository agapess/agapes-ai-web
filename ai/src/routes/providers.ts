import { Router } from 'express'
import { buildAdapter, buildDefaultAdapter, type ProviderConfig } from '../adapters/registry.js'

export const providersRouter: ReturnType<typeof Router> = Router()

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
