import { COLLECTION_NAME } from './client';
import { getEmbedding } from './embeddings';
import type { FaqSearchResult } from '@repo/shared';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

export interface SearchOptions {
  topK?: number;
  minScore?: number;
  category?: string;
}

interface QdrantSearchResult {
  id: number | string;
  score: number;
  payload?: Record<string, unknown>;
}

async function searchQdrant(
  collectionName: string,
  vector: number[],
  options: { limit: number; score_threshold: number; filter?: unknown }
): Promise<QdrantSearchResult[]> {
  const url = `${QDRANT_URL}/collections/${collectionName}/points/search`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {}),
    },
    body: JSON.stringify({
      vector,
      limit: options.limit,
      score_threshold: options.score_threshold,
      with_payload: true,
      filter: options.filter,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Qdrant search failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.result || [];
}

export async function searchFaq(
  query: string,
  options: SearchOptions = {}
): Promise<FaqSearchResult[]> {
  const { topK = 3, minScore = 0.3, category } = options;

  const embedding = await getEmbedding(query);

  const filter = category
    ? {
        must: [{ key: 'category', match: { value: category } }],
      }
    : undefined;

  const results = await searchQdrant(COLLECTION_NAME, embedding, {
    limit: topK,
    score_threshold: minScore,
    filter,
  });

  return results.map((r) => ({
    id: r.id as number,
    category: r.payload?.category as string,
    subcategory: r.payload?.subcategory as string | undefined,
    question: r.payload?.question as string,
    answer: r.payload?.answer as string,
    similarity: r.score,
  }));
}

export function formatSearchResults(results: FaqSearchResult[]): string {
  if (results.length === 0) {
    return '관련된 FAQ를 찾지 못했습니다.';
  }

  return results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.category}${r.subcategory ? ` > ${r.subcategory}` : ''}\n` +
        `Q: ${r.question}\n` +
        `A: ${r.answer}\n` +
        `(유사도: ${(r.similarity * 100).toFixed(1)}%)`
    )
    .join('\n\n');
}
