# Stage 1: Dependencies
FROM oven/bun:1.3.7 AS deps

WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/rag-agent-web/package.json apps/rag-agent-web/
COPY packages/db/package.json packages/db/
COPY packages/vector/package.json packages/vector/
COPY packages/agents/package.json packages/agents/
COPY packages/shared/package.json packages/shared/
COPY packages/protocol/package.json packages/protocol/

RUN bun install --frozen-lockfile

# Stage 2: Production
FROM oven/bun:1.3.7

WORKDIR /app

# 의존성 구조 전체 복사 (root + workspace node_modules)
COPY --from=deps /app/ ./

# 소스 코드 복사 (.dockerignore가 node_modules 제외하므로 deps 위에 덮어쓰기 안전)
COPY . .

# ONNX 임베딩 모델 사전 다운로드 (Transformers.js, ~113MB)
# 컨테이너 재시작 시 매번 다운로드하지 않도록 이미지에 포함
RUN bun run packages/vector/src/scripts/warmup-model.ts

RUN chmod +x /app/entrypoint.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["/app/entrypoint.sh"]
