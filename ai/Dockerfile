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

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/ai/dist ./dist
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/ai/package.json ./package.json
# Remove workspace: protocol dep (shared is already compiled and copied above)
RUN sed -i '/"@ai-builder\/shared"/d' package.json && npm install --omit=dev
EXPOSE 4001
CMD ["node", "dist/index.js"]
