import { COLLECTION_NAME, EMBEDDING_DIMENSION } from './client';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

/**
 * Delete a FAQ item from Qdrant by its ID
 */
export async function deleteFaqFromVector(faqId: number): Promise<boolean> {
  try {
    const url = `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/delete`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {}),
      },
      body: JSON.stringify({
        filter: {
          must: [{ key: 'id', match: { value: faqId } }],
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Qdrant delete failed: ${response.status} ${text}`);
    }

    console.log(`[Vector] Deleted FAQ ${faqId} from Qdrant`);
    return true;
  } catch (error) {
    console.error(`[Vector] Failed to delete FAQ ${faqId}:`, error);
    return false;
  }
}

/**
 * Reset collection - delete and recreate with proper schema
 */
export async function resetCollection(): Promise<void> {
  console.log(`[Vector] Resetting collection: ${COLLECTION_NAME}`);

  // Delete collection if exists
  const deleteUrl = `${QDRANT_URL}/collections/${COLLECTION_NAME}`;
  try {
    await fetch(deleteUrl, {
      method: 'DELETE',
      headers: QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {},
    });
    console.log(`[Vector] Collection deleted`);
  } catch {
    console.log(`[Vector] Collection did not exist or delete failed, continuing...`);
  }

  // Create collection with proper schema
  const createUrl = `${QDRANT_URL}/collections/${COLLECTION_NAME}`;
  const response = await fetch(createUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {}),
    },
    body: JSON.stringify({
      vectors: {
        size: EMBEDDING_DIMENSION,
        distance: 'Cosine',
      },
      optimizers_config: {
        indexing_threshold: 20000,
      },
      hnsw_config: {
        m: 16,
        ef_construct: 100,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create collection: ${response.status} ${text}`);
  }

  console.log(`[Vector] Collection recreated with ${EMBEDDING_DIMENSION} dimensions`);
}

/**
 * Delete multiple FAQ items from Qdrant
 */
export async function deleteFaqsFromVector(faqIds: number[]): Promise<number> {
  let deleted = 0;
  for (const id of faqIds) {
    if (await deleteFaqFromVector(id)) {
      deleted++;
    }
  }
  return deleted;
}
