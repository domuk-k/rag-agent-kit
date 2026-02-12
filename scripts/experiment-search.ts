/**
 * Atlas Search 개선 실험 스크립트
 *
 * 다양한 전략을 비교:
 * 1. Raw BM25 스코어 분포 분석
 * 2. question 필드 부스트 (compound query)
 * 3. 정규화 함수 비교 (k=1 vs k=2 vs k=3)
 * 4. Score gap 분석 (1위-2위 차이)
 */

import { getDb, closeDb } from '@repo/db';

interface TestCase {
  query: string;
  expectedFaqId: number | null;
  category: string;
}

const testCases: TestCase[] = [
  // 1. 정확 매칭
  { query: '로그인이 안돼요', expectedFaqId: 29, category: '정확 매칭' },
  { query: '수강 취소는 어떻게 하나요?', expectedFaqId: 1, category: '정확 매칭' },
  { query: '과제는 어떻게 제출하나요?', expectedFaqId: 18, category: '정확 매칭' },
  { query: '패스워드를 분실했어요', expectedFaqId: 28, category: '정확 매칭' },
  { query: '도서는 언제 배송되나요?', expectedFaqId: 25, category: '정확 매칭' },
  // 2. 패러프레이즈
  { query: '비밀번호를 잊어버렸어요', expectedFaqId: 28, category: '패러프레이즈' },
  { query: '강의 취소하고 싶어요', expectedFaqId: 1, category: '패러프레이즈' },
  { query: '비밀번호 바꾸는 방법', expectedFaqId: 28, category: '패러프레이즈' },
  { query: '접속이 안 됩니다', expectedFaqId: 29, category: '패러프레이즈' },
  { query: '수료증 출력하려면 어떻게 해요', expectedFaqId: 11, category: '패러프레이즈' },
  // 3. 구어체
  { query: '과제 제출 어떻게 함?', expectedFaqId: 18, category: '구어체' },
  { query: '로그인 안됨', expectedFaqId: 29, category: '구어체' },
  { query: '학습 진도 안올라감', expectedFaqId: 15, category: '구어체' },
  { query: '시험 언제 봄?', expectedFaqId: 23, category: '구어체' },
  { query: '수강 취소 하고싶음', expectedFaqId: 1, category: '구어체' },
  // 4. 키워드
  { query: '배송', expectedFaqId: 25, category: '키워드' },
  { query: '수료증', expectedFaqId: 11, category: '키워드' },
  { query: '진도율', expectedFaqId: 15, category: '키워드' },
  { query: '탈퇴', expectedFaqId: 2, category: '키워드' },
  { query: 'mOTP', expectedFaqId: 37, category: '키워드' },
  // 5. 범위 외
  { query: '오늘 날씨 어때?', expectedFaqId: null, category: '범위 외' },
  { query: '피자 주문하고 싶어요', expectedFaqId: null, category: '범위 외' },
  { query: '환불 절차 알려주세요', expectedFaqId: null, category: '범위 외' },
  { query: '강사 이름이 뭐예요?', expectedFaqId: null, category: '범위 외' },
  { query: '다른 교육기관 추천해주세요', expectedFaqId: null, category: '범위 외' },
];

// ─── 정규화 함수들 ───

const normalizers = {
  'k=1 (현재)': (s: number) => s / (s + 1),
  'k=2': (s: number) => s / (s + 2),
  'k=3': (s: number) => s / (s + 3),
  'k=5': (s: number) => s / (s + 5),
  'log': (s: number) => Math.log(1 + s) / Math.log(1 + 10), // log(1+s)/log(11)
};

// ─── Atlas Search 쿼리 전략들 ───

type Strategy = {
  name: string;
  buildPipeline: (query: string) => object[];
};

const strategies: Strategy[] = [
  {
    name: 'A: text (현재)',
    buildPipeline: (query: string) => [
      {
        $search: {
          index: 'faq_text_search',
          text: { query, path: ['question', 'answer'] },
        },
      },
      {
        $project: {
          _id: 0, id: 1, category: 1, question: 1, answer: 1,
          score: { $meta: 'searchScore' },
        },
      },
      { $limit: 5 },
    ],
  },
  {
    name: 'B: compound (question×3)',
    buildPipeline: (query: string) => [
      {
        $search: {
          index: 'faq_text_search',
          compound: {
            should: [
              { text: { query, path: 'question', score: { boost: { value: 3 } } } },
              { text: { query, path: 'answer' } },
            ],
          },
        },
      },
      {
        $project: {
          _id: 0, id: 1, category: 1, question: 1, answer: 1,
          score: { $meta: 'searchScore' },
        },
      },
      { $limit: 5 },
    ],
  },
  {
    name: 'C: compound (question×5)',
    buildPipeline: (query: string) => [
      {
        $search: {
          index: 'faq_text_search',
          compound: {
            should: [
              { text: { query, path: 'question', score: { boost: { value: 5 } } } },
              { text: { query, path: 'answer' } },
            ],
          },
        },
      },
      {
        $project: {
          _id: 0, id: 1, category: 1, question: 1, answer: 1,
          score: { $meta: 'searchScore' },
        },
      },
      { $limit: 5 },
    ],
  },
  {
    name: 'D: question only',
    buildPipeline: (query: string) => [
      {
        $search: {
          index: 'faq_text_search',
          text: { query, path: 'question' },
        },
      },
      {
        $project: {
          _id: 0, id: 1, category: 1, question: 1, answer: 1,
          score: { $meta: 'searchScore' },
        },
      },
      { $limit: 5 },
    ],
  },
];

async function runStrategy(db: any, strategy: Strategy) {
  const results: {
    query: string;
    category: string;
    expectedId: number | null;
    topId: number | null;
    rawScore: number;
    top3: { id: number; question: string; rawScore: number }[];
    scoreGap: number; // 1위-2위 raw score 차이
  }[] = [];

  for (const tc of testCases) {
    try {
      const pipeline = strategy.buildPipeline(tc.query);
      const docs = await db.collection('faqs').aggregate(pipeline).toArray();

      const topId = docs[0]?.id ?? null;
      const rawScore = docs[0]?.score ?? 0;
      const secondScore = docs[1]?.score ?? 0;

      results.push({
        query: tc.query,
        category: tc.category,
        expectedId: tc.expectedFaqId,
        topId,
        rawScore,
        top3: docs.slice(0, 3).map((d: any) => ({
          id: d.id,
          question: d.question,
          rawScore: d.score,
        })),
        scoreGap: rawScore - secondScore,
      });
    } catch {
      results.push({
        query: tc.query,
        category: tc.category,
        expectedId: tc.expectedFaqId,
        topId: null,
        rawScore: 0,
        top3: [],
        scoreGap: 0,
      });
    }
  }

  return results;
}

function evaluateWithNormalizer(
  strategyResults: Awaited<ReturnType<typeof runStrategy>>,
  normalize: (s: number) => number,
  threshold: number
) {
  let correct = 0;
  const total = strategyResults.length;

  for (const r of strategyResults) {
    const similarity = normalize(r.rawScore);
    const isOutOfScope = r.expectedId === null;
    const isCorrect = isOutOfScope
      ? similarity < threshold
      : r.topId === r.expectedId;
    if (isCorrect) correct++;
  }

  return { correct, total, accuracy: correct / total };
}

async function main() {
  const db = await getDb();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Atlas Search 개선 실험');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ─── 1. 전략별 Raw 스코어 수집 ───
  const allResults: Record<string, Awaited<ReturnType<typeof runStrategy>>> = {};

  for (const strategy of strategies) {
    console.log(`[실행] ${strategy.name}...`);
    allResults[strategy.name] = await runStrategy(db, strategy);
  }

  // ─── 2. Raw 스코어 분포 출력 ───
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  Part 1: Raw BM25 스코어 분포 (전략 A: 현재)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const currentResults = allResults['A: text (현재)'];
  for (const r of currentResults) {
    const mark = r.expectedId === null ? '(범위외)' : `(FAQ#${r.expectedId})`;
    const hitMark = r.topId === r.expectedId ? '✓' : r.expectedId === null ? '?' : '✗';
    console.log(`  ${hitMark} [${r.category}] "${r.query}" ${mark}`);
    console.log(`    Raw: ${r.rawScore.toFixed(4)} | Gap: ${r.scoreGap.toFixed(4)}`);
    if (r.top3.length > 0) {
      const t3 = r.top3.map(t => `#${t.id}(${t.rawScore.toFixed(2)})`).join(', ');
      console.log(`    Top3: ${t3}`);
    }
    console.log('');
  }

  // ─── 3. 카테고리별 Raw 스코어 통계 ───
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Part 2: 카테고리별 Raw 스코어 통계 (전략 A)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const categories = [...new Set(testCases.map(t => t.category))];
  for (const cat of categories) {
    const catResults = currentResults.filter(r => r.category === cat);
    const scores = catResults.map(r => r.rawScore);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    console.log(`  ${cat}: avg=${avg.toFixed(3)}, min=${min.toFixed(3)}, max=${max.toFixed(3)}`);
  }

  // ─── 4. 전략 × 정규화 × threshold 매트릭스 ───
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  Part 3: 전략 × 정규화 × threshold 정확도 매트릭스');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7];

  // 헤더
  const header = '전략 × 정규화'.padEnd(30) + thresholds.map(t => `thr=${t}`).join('  ');
  console.log(header);
  console.log('─'.repeat(header.length));

  for (const strategyName of Object.keys(allResults)) {
    for (const [normName, normFn] of Object.entries(normalizers)) {
      const label = `${strategyName.slice(0, 2)} × ${normName}`.padEnd(30);
      const scores = thresholds.map(t => {
        const { accuracy } = evaluateWithNormalizer(allResults[strategyName], normFn, t);
        return `${(accuracy * 100).toFixed(0)}%`.padStart(6);
      });
      console.log(`${label}${scores.join('  ')}`);
    }
    console.log('');
  }

  // ─── 5. 카테고리별 상세 (최적 조합 찾기) ───
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Part 4: 최고 조합의 카테고리별 상세');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 모든 조합에서 최고 정확도 찾기
  let bestCombo = { strategy: '', norm: '', threshold: 0, accuracy: 0 };

  for (const strategyName of Object.keys(allResults)) {
    for (const [normName, normFn] of Object.entries(normalizers)) {
      for (const thr of thresholds) {
        const { accuracy } = evaluateWithNormalizer(allResults[strategyName], normFn, thr);
        if (accuracy > bestCombo.accuracy) {
          bestCombo = { strategy: strategyName, norm: normName, threshold: thr, accuracy };
        }
      }
    }
  }

  console.log(`  최고 조합: ${bestCombo.strategy} × ${bestCombo.norm} × thr=${bestCombo.threshold}`);
  console.log(`  전체 정확도: ${(bestCombo.accuracy * 100).toFixed(1)}%\n`);

  // 카테고리별 상세
  const bestNormFn = normalizers[bestCombo.norm as keyof typeof normalizers];
  const bestResults = allResults[bestCombo.strategy];

  for (const cat of categories) {
    const catResults = bestResults.filter(r => r.category === cat);
    let catCorrect = 0;

    for (const r of catResults) {
      const sim = bestNormFn(r.rawScore);
      const isOutOfScope = r.expectedId === null;
      const isCorrect = isOutOfScope ? sim < bestCombo.threshold : r.topId === r.expectedId;
      if (isCorrect) catCorrect++;

      if (!isCorrect) {
        console.log(`  ✗ [${cat}] "${r.query}" — raw=${r.rawScore.toFixed(3)}, sim=${(sim * 100).toFixed(1)}%`);
        if (isOutOfScope) {
          console.log(`    기대: ${bestCombo.threshold} 미만, 실제: ${(sim * 100).toFixed(1)}%`);
        } else {
          console.log(`    기대: FAQ#${r.expectedId}, 실제: #${r.topId}`);
        }
      }
    }

    console.log(`  ${cat}: ${catCorrect}/${catResults.length} (${((catCorrect / catResults.length) * 100).toFixed(0)}%)`);
    console.log('');
  }

  // ─── 6. Score gap 분석 ───
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Part 5: Score Gap 분석 (1위-2위 차이)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const inScope = currentResults.filter(r => r.expectedId !== null);
  const outOfScope = currentResults.filter(r => r.expectedId === null);

  const inScopeGaps = inScope.map(r => r.scoreGap);
  const outGaps = outOfScope.map(r => r.scoreGap);

  console.log(`  범위 내: avg gap=${(inScopeGaps.reduce((a, b) => a + b, 0) / inScopeGaps.length).toFixed(3)}`);
  console.log(`           gaps: [${inScopeGaps.map(g => g.toFixed(2)).join(', ')}]`);
  console.log(`  범위 외: avg gap=${(outGaps.reduce((a, b) => a + b, 0) / outGaps.length).toFixed(3)}`);
  console.log(`           gaps: [${outGaps.map(g => g.toFixed(2)).join(', ')}]`);

  console.log('\n═══════════════════════════════════════════════════════════════');

  await closeDb();
}

main().catch(console.error);
