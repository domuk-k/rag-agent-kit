import { getDb, getVectorCount, EMBEDDING_DIMENSION } from '@repo/db';

async function main() {
  console.log(`[Setup] Initializing SQLite with FTS5 + sqlite-vec...`);

  const db = getDb();

  // Verify sqlite-vec is loaded
  const { vec_version } = db
    .prepare(`SELECT vec_version() as vec_version`)
    .get() as { vec_version: string };

  console.log(`[Setup] sqlite-vec version: ${vec_version}`);
  console.log(`[Setup] Embedding dimension: ${EMBEDDING_DIMENSION}`);

  const vecCount = getVectorCount();
  console.log(`[Setup] Current vectors in faq_vec: ${vecCount}`);

  console.log(`[Setup] Done! Schema is ready.`);
}

main().catch(console.error);
