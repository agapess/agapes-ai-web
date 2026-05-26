export const config = {
  port: parseInt(process.env.AI_PORT ?? '4001', 10),
  webServiceUrl: process.env.WEB_SERVICE_URL ?? 'http://localhost:4000',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
  lmstudioBaseUrl: process.env.LMSTUDIO_BASE_URL ?? 'http://localhost:1234',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6380',
  defaultProvider: (process.env.DEFAULT_PROVIDER ?? 'ollama') as 'ollama' | 'lmstudio',
  defaultModel: process.env.DEFAULT_MODEL ?? 'llama3.2',
} as const
