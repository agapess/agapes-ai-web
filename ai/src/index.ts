import express from 'express'
import cors from 'cors'
import { chatRouter } from './routes/chat.js'
import { providersRouter } from './routes/providers.js'
import { config } from './config.js'

const app = express()

app.use(cors({ origin: '*' }))
// Raise body limit to 10 MB — pages with large SVGs/images in the code can
// exceed the default 100 kb limit now that we send live page code to the AI
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api/chat', chatRouter)
app.use('/api/providers', providersRouter)

app.listen(config.port, () => {
  console.log(`AI service running on port ${config.port}`)
  console.log(`Ollama endpoint: ${config.ollamaBaseUrl}`)
})
