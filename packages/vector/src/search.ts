/**
 * FAQ 하이브리드 검색: Atlas Search (BM25) + Atlas Vector Search + RRF
 *
 * 설계:
 *   - 순서(ranking): RRF(k=60) — BM25와 vector 순위를 병합, 동점 시 vector rank 우선
 *   - 유사도(similarity): BM25 정규화 score/(score+2) — threshold 판단용
 *   - 이중 확인 게이트: 양쪽 모두 매칭 시 threshold 완화 (0.5), 단독 매칭 시 엄격 (0.7)
 *
 * Vector cosine score는 e5-small에서 0.91-0.97로 클러스터되어
 * in-scope/out-of-scope 분리에 부적합하므로 threshold에 사용하지 않음.
 */

import { getDb } from '@repo/db';
import { embedQuery } from './embeddings';
import type { FaqSearchResult } from '@repo/shared';

export interface SearchOptions {
  topK?: number;
  category?: string;
}

const RRF_K = 60;
const SEARCH_CANDIDATES = 20;
const BM25_NORM_K = 2;
const THRESHOLD_BOTH = 0.55; // BM25 + Vector 양쪽 확인 시 완화
const THRESHOLD_SINGLE = 0.7; // 단독 소스 시 엄격

interface ScoredDoc {
  id: number;
  category: string;
  subcategory?: string | null;
  question: string;
  answer: string;
  score: number; // raw BM25 or vectorSearchScore
}

export async function searchFaq(
  query: string,
  options: SearchOptions = {}
): Promise<FaqSearchResult[]> {
  const { topK = 5, category } = options;
  const db = await getDb();
  const col = db.collection('faqs');

  try {
    const [textResults, vectorResults] = await Promise.all([
      runTextSearch(col, query, category),
      runVectorSearch(col, query, category),
    ]);

    // ─── RRF 병합: 순서 결정 ───
    const merged = new Map<
      number,
      { doc: ScoredDoc; rrfScore: number; bm25Raw: number; vecRank: number; inBoth: boolean }
    >();

    for (let rank = 0; rank < textResults.length; rank++) {
      const doc = textResults[rank];
      merged.set(doc.id, {
        doc,
        rrfScore: 1 / (RRF_K + rank + 1),
        bm25Raw: doc.score,
        vecRank: SEARCH_CANDIDATES,
        inBoth: false,
      });
    }

    for (let rank = 0; rank < vectorResults.length; rank++) {
      const doc = vectorResults[rank];
      const existing = merged.get(doc.id);
      if (existing) {
        existing.rrfScore += 1 / (RRF_K + rank + 1);
        existing.vecRank = rank;
        existing.inBoth = true;
      } else {
        merged.set(doc.id, {
          doc,
          rrfScore: 1 / (RRF_K + rank + 1),
          bm25Raw: 0,
          vecRank: rank,
          inBoth: false,
        });
      }
    }

    // ─── RRF 순서로 정렬, 동점 시 vector rank 우선 (의미 유사도) ───
    const sorted = [...merged.values()]
      .sort((a, b) => b.rrfScore - a.rrfScore || a.vecRank - b.vecRank)
      .slice(0, topK);

    // ─── 이중 확인 게이트: 양쪽 확인 시 threshold 완화 ───
    const results: FaqSearchResult[] = [];
    for (const { doc, bm25Raw, inBoth } of sorted) {
      const similarity = bm25Raw / (bm25Raw + BM25_NORM_K);
      const threshold = inBoth ? THRESHOLD_BOTH : THRESHOLD_SINGLE;
      if (similarity < threshold) continue;
      results.push({
        id: doc.id,
        category: doc.category,
        subcategory: doc.subcategory,
        question: doc.question,
        answer: doc.answer,
        similarity,
      });
    }

    return results;
  } catch (err) {
    console.warn('[Search] Hybrid search failed:', err);
    return [];
  }
}

/** Atlas Search (BM25, lucene.korean) */
async function runTextSearch(
  col: any,
  query: string,
  category?: string
): Promise<ScoredDoc[]> {
  try {
    const pipeline: object[] = [
      {
        $search: {
          index: 'faq_text_search',
          text: { query, path: ['question', 'answer'] },
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

    if (category) pipeline.push({ $match: { category } });
    pipeline.push({ $limit: SEARCH_CANDIDATES });

    return await col.aggregate(pipeline).toArray();
  } catch {
    return [];
  }
}

/** Transformers.js 임베딩 → Atlas Vector Search */
async function runVectorSearch(
  col: any,
  query: string,
  category?: string
): Promise<ScoredDoc[]> {
  try {
    const queryVector = await embedQuery(query);

    const pipeline: object[] = [
      {
        $vectorSearch: {
          index: 'faq_vector_index',
          path: 'embedding',
          queryVector,
          numCandidates: SEARCH_CANDIDATES * 5,
          limit: SEARCH_CANDIDATES,
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
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ];

    if (category) pipeline.push({ $match: { category } });

    return await col.aggregate(pipeline).toArray();
  } catch {
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
