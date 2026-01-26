#!/bin/sh
# 볼륨에 faq.json이 없으면 시드 데이터 복사
if [ ! -f /app/data/faq.json ]; then
  echo "[Entrypoint] Copying seed data to volume..."
  cp /app/faq-seed.json /app/data/faq.json 2>/dev/null || true
fi

# DB가 없거나 FAQ 0개면 시딩 실행
if [ ! -f /app/data/faq.db ]; then
  echo "[Entrypoint] Running initial seed..."
  cd /app && bun run packages/db/src/scripts/seed.ts
fi

cd /app/apps/api && exec bun run src/index.ts
