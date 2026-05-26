import express from 'express'
import cors from 'cors'
import { chatRouter } from './routes/chat.js'
import { providersRouter } from './routes/providers.js'
import { config } from './config.js'

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api/chat', chatRouter)
app.use('/api/providers', providersRouter)

app.listen(config.port, () => {
  console.log(`AI service running on port ${config.port}`)
  console.log(`Ollama endpoint: ${config.ollamaBaseUrl}`)
})
