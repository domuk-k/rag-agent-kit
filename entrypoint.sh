#!/bin/sh
set -e

echo "[Entrypoint] Waiting for MongoDB..."
RETRIES=30
until bun -e "
  const { MongoClient } = require('mongodb');
  const c = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  c.connect().then(() => { c.close(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    echo "[Entrypoint] MongoDB connection timeout!"
    exit 1
  fi
  echo "[Entrypoint] Waiting for MongoDB... ($RETRIES retries left)"
  sleep 1
done
echo "[Entrypoint] MongoDB connected!"

# FAQ 0개면 시딩 실행
FAQ_COUNT=$(bun -e "
  const { getDb, getFaqCount, closeDb } = require('@repo/db');
  getDb().then(() => getFaqCount()).then(c => { console.log(c); return closeDb(); }).catch(() => console.log('0'));
" 2>/dev/null || echo "0")

if [ "$FAQ_COUNT" = "0" ]; then
  echo "[Entrypoint] No FAQs found. Running initial seed..."
  cd /app && bun run packages/db/src/scripts/seed.ts
fi

cd /app/apps/api && exec bun run src/index.ts
