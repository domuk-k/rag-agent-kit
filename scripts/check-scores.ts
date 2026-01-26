import { searchFaq } from '../packages/vector/src/search';

const queries = [
  '강의 듣는 방법',
  '수업 안 들어져요',
  '환불 어떻게 해요',
  '비밀번호 변경',
  '인터넷 강의 수료 기준',
  '시험 점수 확인',
  '재무제표 다운로드',
  '학습 진행이 안돼요',
  '과제 제출',
  '로그인 안됨',
];

console.log('TIER | Score  | Query              → Best Match');
console.log('-'.repeat(75));

for (const q of queries) {
  const results = await searchFaq(q, { topK: 3, minScore: 0.0 });
  const top = results[0];
  const score = top ? (top.similarity * 100).toFixed(1) + '%' : 'none';
  const tier = top == null ? 'NONE'
    : top.similarity >= 0.5 ? 'HIGH'
    : 'LOW ';
  const match = top ? top.question.slice(0, 35) : '-';
  console.log(`${tier} | ${score.padStart(6)} | ${q.padEnd(18)} → ${match}`);
}
