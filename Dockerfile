FROM node:24-alpine AS base
WORKDIR /app

# Dependências (todas, incluindo as de desenvolvimento, usadas no build e nas migrations).
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Build da aplicação. DATABASE_URL só existe para a validação de env no build (nenhuma conexão é feita).
# APP_URL define o basePath, que o Next fixa no build: mudar APP_URL exige rebuild da imagem.
FROM deps AS builder
COPY . .
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ARG APP_URL=http://localhost:3000
ENV DATABASE_URL=$DATABASE_URL APP_URL=$APP_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Aplica as migrations (drizzle-kit) e encerra. Não faz parte da imagem de runtime.
FROM deps AS migrator
COPY drizzle.config.ts ./
COPY db ./db
CMD ["npx", "drizzle-kit", "migrate"]

# Runtime: apenas o necessário, sem root.
FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# git: os repositórios de contexto dos projetos são criados e commitados pelo app.
RUN apk add --no-cache git && addgroup -S nodejs && adduser -S nextjs -G nodejs \
  && mkdir -p /data/context-repos && chown -R nextjs:nodejs /data
ENV CONTEXT_REPOS_DIR=/data/context-repos
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Template dos repositórios de contexto (lido em tempo de execução).
COPY --from=builder --chown=nextjs:nodejs /app/templates ./templates
# Migrations, aplicadas pelo app ao iniciar (lib/startup.ts).
COPY --from=builder --chown=nextjs:nodejs /app/db/migrations ./db/migrations
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
