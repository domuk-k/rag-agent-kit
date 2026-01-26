import { getDb, getFaqById } from '@repo/db';
import { getEmbedding } from './embeddings';
import type { FaqSearchResult } from '@repo/shared';

export interface SearchOptions {
  topK?: number;
  minScore?: number;
  category?: string;
}

/** FTS5-only 매칭의 기본 유사도 (벡터 검색에 없을 때) */
const DEFAULT_FTS_SIMILARITY = 0.4;

/**
 * 하이브리드 FAQ 검색: FTS5 키워드 + sqlite-vec 벡터 + RRF 병합
 *
 * Pipeline:
 *   1. FTS5 BM25 키워드 검색 (로컬, <1ms)
 *   2. sqlite-vec 코사인 유사도 검색 (로컬, <5ms)
 *   3. Reciprocal Rank Fusion으로 두 결과 병합
 *   4. minScore 필터링 후 반환
 */
export async function searchFaq(
  query: string,
  options: SearchOptions = {}
): Promise<FaqSearchResult[]> {
  const { topK = 5, minScore = 0.3, category } = options;
  const fetchK = topK * 3; // 각 서브쿼리에서 넉넉하게 가져온 뒤 RRF 병합

  // Step 1: FTS5 키워드 검색 (임베딩 불필요, 즉시)
  const ftsResults = ftsSearch(query, fetchK);

  // Step 2: 벡터 유사도 검색 (임베딩 API 호출 필요)
  const embedding = await getEmbedding(query);
  const vecResults = vecSearch(embedding, fetchK);

  // Step 3: RRF 병합
  const merged = reciprocalRankFusion(ftsResults, vecResults);

  // Step 4: RRF 점수 순 정렬 → FAQ 상세 조회 → 필터링
  const sortedEntries = [...merged.entries()]
    .sort((a, b) => b[1].rrfScore - a[1].rrfScore)
    .slice(0, topK);

  const results: FaqSearchResult[] = [];
  for (const [rowid, { similarity }] of sortedEntries) {
    if (similarity < minScore) continue;

    const faq = getFaqById(rowid);
    if (!faq) continue;
    if (category && faq.category !== category) continue;

    results.push({ ...faq, similarity });
  }

  return results;
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

// ─── Internal search functions ───────────────────────────────────

interface FtsRow {
  rowid: number;
  bm25: number;
}

interface VecRow {
  rowid: number;
  distance: number;
}

/** FTS5 BM25 키워드 검색 */
function ftsSearch(query: string, limit: number): FtsRow[] {
  const db = getDb();
  const escaped = escapeFts5Query(query);
  if (!escaped) return [];

  try {
    return db.prepare(`
      SELECT rowid, bm25(faq_fts) as bm25
      FROM faq_fts
      WHERE faq_fts MATCH ?
      ORDER BY bm25
      LIMIT ?
    `).all(escaped, limit) as FtsRow[];
  } catch (err) {
    // FTS5 쿼리 파싱 실패 시 (특수 문자 등) 빈 결과 반환
    console.warn(`[Search] FTS5 query failed for "${query}":`, err);
    return [];
  }
}

/** sqlite-vec 코사인 유사도 검색 */
function vecSearch(embedding: number[], limit: number): VecRow[] {
  const db = getDb();
  try {
    return db.prepare(`
      SELECT rowid, distance
      FROM faq_vec
      WHERE embedding MATCH ?
      ORDER BY distance
      LIMIT ?
    `).all(new Float32Array(embedding), limit) as VecRow[];
  } catch (err) {
    console.warn('[Search] Vector search failed:', err);
    return [];
  }
}

/**
 * Reciprocal Rank Fusion (RRF)
 *
 * 두 검색 결과의 순위를 결합. 양쪽에 모두 등장하는 항목일수록 높은 점수.
 * @see https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf
 */
function reciprocalRankFusion(
  ftsResults: FtsRow[],
  vecResults: VecRow[],
  k = 60
): Map<number, { rrfScore: number; similarity: number }> {
  const scores = new Map<number, { rrfScore: number; similarity: number }>();

  // FTS5 결과 (이미 BM25 순)
  ftsResults.forEach((r, i) => {
    const entry = scores.get(r.rowid) || { rrfScore: 0, similarity: DEFAULT_FTS_SIMILARITY };
    entry.rrfScore += 1 / (k + i + 1);
    scores.set(r.rowid, entry);
  });

  // Vector 결과 (이미 distance 순)
  vecResults.forEach((r, i) => {
    const entry = scores.get(r.rowid) || { rrfScore: 0, similarity: 0 };
    entry.rrfScore += 1 / (k + i + 1);
    entry.similarity = 1 - r.distance; // cosine distance → similarity
    scores.set(r.rowid, entry);
  });

  return scores;
}

/**
 * FTS5 쿼리 이스케이프: 각 토큰을 따옴표로 감싸서 특수 문자 방어.
 * "수강 취소" → '"수강" "취소"' (각 단어가 모두 포함된 문서 검색)
 */
function escapeFts5Query(query: string): string {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => '"' + word.replace(/"/g, '""') + '"');
  return tokens.join(' ');
}
