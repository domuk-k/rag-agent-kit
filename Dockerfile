# Stage 1: Dependencies
FROM oven/bun:1 AS deps

WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/vector/package.json packages/vector/
COPY packages/agents/package.json packages/agents/
COPY packages/shared/package.json packages/shared/
COPY packages/protocol/package.json packages/protocol/

RUN bun install --frozen-lockfile

# Stage 2: Production
FROM oven/bun:1

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN chmod +x /app/entrypoint.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["/app/entrypoint.sh"]
