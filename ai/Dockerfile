FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY ai/package.json ./ai/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/shared/node_modules ./shared/node_modules
COPY --from=deps /app/ai/node_modules ./ai/node_modules
COPY . .
RUN pnpm --filter @ai-builder/shared build
RUN pnpm --filter ai build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/ai/dist ./dist
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/ai/package.json ./ai/package.json
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
RUN pnpm install --prod --no-frozen-lockfile --filter ai
EXPOSE 4001
CMD ["node", "dist/index.js"]
