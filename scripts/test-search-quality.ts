/**
 * Atlas Search 품질 테스트 스크립트
 *
 * 다양한 쿼리 패턴으로 검색 품질을 체계적으로 측정합니다.
 */

import { searchFaq } from '@repo/vector';
import { getDb, closeDb } from '@repo/db';

interface TestCase {
  query: string;
  expectedFaqId: number | null; // null = 범위 외 (매칭 없어야 함)
  category: string;
}

const testCases: TestCase[] = [
  // ─── 1. 정확 매칭 (FAQ 질문과 거의 동일) ───
  { query: '로그인이 안돼요', expectedFaqId: 29, category: '정확 매칭' },
  { query: '수강 취소는 어떻게 하나요?', expectedFaqId: 1, category: '정확 매칭' },
  { query: '과제는 어떻게 제출하나요?', expectedFaqId: 18, category: '정확 매칭' },
  { query: '패스워드를 분실했어요', expectedFaqId: 28, category: '정확 매칭' },
  { query: '도서는 언제 배송되나요?', expectedFaqId: 25, category: '정확 매칭' },

  // ─── 2. 의미 동일, 표현 다름 (패러프레이즈) ───
  { query: '비밀번호를 잊어버렸어요', expectedFaqId: 28, category: '패러프레이즈' },
  { query: '강의 취소하고 싶어요', expectedFaqId: 1, category: '패러프레이즈' },
  { query: '비밀번호 바꾸는 방법', expectedFaqId: 28, category: '패러프레이즈' },
  { query: '접속이 안 됩니다', expectedFaqId: 29, category: '패러프레이즈' },
  { query: '수료증 출력하려면 어떻게 해요', expectedFaqId: 11, category: '패러프레이즈' },

  // ─── 3. 구어체/비격식 ───
  { query: '과제 제출 어떻게 함?', expectedFaqId: 18, category: '구어체' },
  { query: '로그인 안됨', expectedFaqId: 29, category: '구어체' },
  { query: '학습 진도 안올라감', expectedFaqId: 15, category: '구어체' },
  { query: '시험 언제 봄?', expectedFaqId: 23, category: '구어체' },
  { query: '수강 취소 하고싶음', expectedFaqId: 1, category: '구어체' },

  // ─── 4. 키워드 부분 매칭 ───
  { query: '배송', expectedFaqId: 25, category: '키워드' },
  { query: '수료증', expectedFaqId: 11, category: '키워드' },
  { query: '진도율', expectedFaqId: 15, category: '키워드' },
  { query: '탈퇴', expectedFaqId: 2, category: '키워드' },
  { query: 'mOTP', expectedFaqId: 37, category: '키워드' },

  // ─── 5. 범위 외 (매칭 없어야 함) ───
  { query: '오늘 날씨 어때?', expectedFaqId: null, category: '범위 외' },
  { query: '피자 주문하고 싶어요', expectedFaqId: null, category: '범위 외' },
  { query: '환불 절차 알려주세요', expectedFaqId: null, category: '범위 외' },
  { query: '강사 이름이 뭐예요?', expectedFaqId: null, category: '범위 외' },
  { query: '다른 교육기관 추천해주세요', expectedFaqId: null, category: '범위 외' },
];

async function main() {
  await getDb();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Atlas Search (lucene.korean) 품질 테스트');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let correct = 0;
  let total = 0;
  const categoryResults: Record<string, { correct: number; total: number }> = {};

  for (const tc of testCases) {
    total++;
    const results = await searchFaq(tc.query, { topK: 3, minScore: 0.3 });
    const topResult = results[0] ?? null;
    const topId = topResult?.id ?? null;
    const topScore = topResult?.similarity ?? 0;

    const isOutOfScope = tc.expectedFaqId === null;
    const isCorrect = isOutOfScope
      ? topScore < 0.5 // 범위 외: 0.5 미만이면 정답
      : topId === tc.expectedFaqId;

    if (isCorrect) correct++;

    // 카테고리별 집계
    if (!categoryResults[tc.category]) {
      categoryResults[tc.category] = { correct: 0, total: 0 };
    }
    categoryResults[tc.category].total++;
    if (isCorrect) categoryResults[tc.category].correct++;

    const mark = isCorrect ? '✓' : '✗';
    const scoreStr = topScore > 0 ? `${(topScore * 100).toFixed(1)}%` : '  N/A';

    if (isOutOfScope) {
      console.log(`  ${mark} [${tc.category}] "${tc.query}"`);
      console.log(`    → 1위: ${topResult ? `"${topResult.question}" (${scoreStr})` : '결과 없음'}`);
      console.log(`    → 기대: 0.5 미만 (범위 외), 실제: ${scoreStr}`);
    } else {
      console.log(`  ${mark} [${tc.category}] "${tc.query}"`);
      console.log(`    → 1위: ${topResult ? `[${topId}] "${topResult.question}" (${scoreStr})` : '결과 없음'}`);
      if (!isCorrect) {
        console.log(`    → 기대: FAQ #${tc.expectedFaqId}, 실제: ${topId ?? 'N/A'}`);
      }
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  전체 정확도: ${correct}/${total} (${((correct / total) * 100).toFixed(1)}%)`);
  console.log('───────────────────────────────────────────────────────────────');
  for (const [cat, r] of Object.entries(categoryResults)) {
    console.log(`  ${cat}: ${r.correct}/${r.total} (${((r.correct / r.total) * 100).toFixed(1)}%)`);
  }
  console.log('═══════════════════════════════════════════════════════════════');

  await closeDb();
}

main().catch(console.error);
