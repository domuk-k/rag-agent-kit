/**
 * FAQ 검색: Atlas Search (lucene.korean) 단독
 *
 * Pipeline:
 *   1. Atlas Search (lucene.korean Nori 형태소 분석) 키워드 검색
 *   2. BM25 스코어 정규화 → 라우팅
 */

import { getDb } from '@repo/db';
import type { FaqSearchResult, FaqItem } from '@repo/shared';

export interface SearchOptions {
  topK?: number;
  minScore?: number;
  category?: string;
}

/**
 * Atlas Search 스코어를 0-1 범위의 유사도로 정규화.
 * BM25 스코어는 0-∞ 범위이므로 sigmoid-like 변환 적용.
 */
function normalizeScore(score: number): number {
  // BM25 스코어 → 0-1 유사도 (경험적 sigmoid 변환)
  return score / (score + 1);
}

export async function searchFaq(
  query: string,
  options: SearchOptions = {}
): Promise<FaqSearchResult[]> {
  const { topK = 5, minScore = 0.3, category } = options;
  const db = await getDb();

  try {
    const pipeline: object[] = [
      {
        $search: {
          index: 'faq_text_search',
          text: {
            query,
            path: ['question', 'answer'],
          },
        },
      },
      {
        $project: {
          _id: 0,
          id: 1,
          category: 1,
          subcategory: 1,
          question: 1,
          answer: 1,
          score: { $meta: 'searchScore' },
        },
      },
    ];

    // 카테고리 필터
    if (category) {
      pipeline.push({ $match: { category } });
    }

    pipeline.push({ $limit: topK });

    const docs = await db.collection('faqs').aggregate(pipeline).toArray();

    const results: FaqSearchResult[] = [];
    for (const d of docs) {
      const similarity = normalizeScore(d.score);
      if (similarity < minScore) continue;
      results.push({
        id: d.id,
        category: d.category,
        subcategory: d.subcategory,
        question: d.question,
        answer: d.answer,
        similarity,
      });
    }

    return results;
  } catch (err) {
    console.warn('[Search] Atlas Search failed:', err);
    return [];
  }
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
