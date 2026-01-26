import { searchFaq } from '../packages/vector/src/search';

const testQueries = [
  '수강 취소하고 싶어요',
  '비밀번호 바꾸고 싶어요',
  '수료증 발급',
  '진도율이 안 올라가요',
  '시험 재응시',
  '교재 언제 오나요',
  '로그인이 안돼요',
  '환불 받고 싶어요',
  '영상이 안 나와요',
  '과제 제출 방법',
];

async function main() {
  console.log('='.repeat(60));
  console.log('Hybrid Search Test (FTS5 + sqlite-vec, text-embedding-3-small)');
  console.log('='.repeat(60));

  for (const query of testQueries) {
    const results = await searchFaq(query, { topK: 3, minScore: 0.3 });

    console.log('\n📝 "' + query + '"');
    if (results.length === 0) {
      console.log('   ❌ No results found');
    } else {
      results.forEach((r) => {
        const score = (r.similarity * 100).toFixed(1);
        const emoji = r.similarity > 0.7 ? '🟢' : r.similarity > 0.5 ? '🟡' : '🔴';
        const question = r.question.length > 40 ? r.question.slice(0, 40) + '...' : r.question;
        console.log('   ' + emoji + ' ' + score + '% | ' + question);
      });
    }
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
