import { COLLECTION_NAME } from './client';
import { getEmbeddings } from './embeddings';
import type { FaqItem } from '@repo/shared';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

async function upsertToQdrant(collectionName: string, points: unknown[]): Promise<void> {
  const url = `${QDRANT_URL}/collections/${collectionName}/points?wait=true`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {}),
    },
    body: JSON.stringify({ points }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Qdrant upsert failed: ${response.status} ${text}`);
  }
}

export async function upsertFaqItems(items: FaqItem[]): Promise<void> {
  console.log(`[Upsert] Generating embeddings for ${items.length} items...`);

  const questions = items.map((item) => item.question);
  const embeddings = await getEmbeddings(questions);

  console.log(`[Upsert] Uploading to Qdrant...`);

  const points = items.map((item, index) => ({
    id: item.id,
    vector: embeddings[index],
    payload: {
      category: item.category,
      subcategory: item.subcategory,
      question: item.question,
      answer: item.answer,
    },
  }));

  // Batch upsert (100 items per batch)
  const batchSize = 100;
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    await upsertToQdrant(COLLECTION_NAME, batch);
    console.log(`[Upsert] Uploaded ${Math.min(i + batchSize, points.length)}/${points.length}`);
  }

  console.log(`[Upsert] Complete!`);
}
