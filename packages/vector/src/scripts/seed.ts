import { upsertFaqItems } from '../upsert';
import type { FaqItem } from '@repo/shared';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Sample FAQ data (fallback if no faq.json exists)
const SAMPLE_FAQ: FaqItem[] = [
  {
    id: 1,
    category: '정산',
    question: '정산은 언제 되나요?',
    answer:
      '스마트스토어 정산은 배송완료 후 구매확정이 되면 진행됩니다. 자동 구매확정은 배송완료 후 8일 후에 이루어지며, 정산은 매주 화요일에 진행됩니다. 정산금은 화요일 정산 처리 후 2~3 영업일 내에 등록된 계좌로 입금됩니다.',
  },
  {
    id: 2,
    category: '정산',
    question: '정산 수수료는 얼마인가요?',
    answer:
      '스마트스토어 판매 수수료는 결제 방식에 따라 다릅니다. 네이버페이 결제 시 2%, 신용카드 결제 시 3.3%, 계좌이체 시 1.5%가 부과됩니다. 단, 스마트스토어 입점 후 6개월간 프로모션 수수료가 적용될 수 있습니다.',
  },
  {
    id: 3,
    category: '상품등록',
    question: '상품 등록은 어떻게 하나요?',
    answer:
      '스마트스토어 판매자센터에 로그인 후 [상품관리] > [상품등록]에서 새 상품을 등록할 수 있습니다. 카테고리 선택, 상품명, 가격, 상세 이미지, 배송 정보 등을 입력하면 됩니다.',
  },
  {
    id: 4,
    category: '상품등록',
    question: '상품 이미지 사이즈는 어떻게 해야 하나요?',
    answer:
      '대표 이미지는 1000x1000 픽셀 이상 권장합니다. 정사각형 비율(1:1)이 가장 좋으며, 최대 파일 크기는 10MB입니다. 상세 이미지는 너비 860픽셀을 권장합니다.',
  },
  {
    id: 5,
    category: '배송',
    question: '배송비 설정은 어떻게 하나요?',
    answer:
      '판매자센터 [배송관리] > [배송비 관리]에서 설정 가능합니다. 무료배송, 유료배송, 조건부 무료배송(일정 금액 이상 구매 시 무료) 중 선택할 수 있으며, 도서산간 추가 배송비도 설정 가능합니다.',
  },
  {
    id: 6,
    category: '배송',
    question: '송장번호 등록은 어떻게 하나요?',
    answer:
      '판매자센터 [주문관리] > [발송처리]에서 주문 건을 선택 후 택배사와 송장번호를 입력합니다. 대량 등록 시 엑셀 업로드 기능을 이용하면 편리합니다.',
  },
  {
    id: 7,
    category: '주문',
    question: '주문 취소는 어떻게 처리하나요?',
    answer:
      '발송 전 취소 요청은 판매자센터 [주문관리]에서 직접 취소 처리 가능합니다. 발송 후에는 고객이 반품 신청을 해야 하며, 반품 완료 후 환불 처리됩니다.',
  },
  {
    id: 8,
    category: '반품/교환',
    question: '반품 배송비는 누가 부담하나요?',
    answer:
      '단순 변심에 의한 반품은 구매자가 배송비를 부담합니다. 상품 하자나 오배송의 경우 판매자가 부담합니다. 배송비는 왕복 기준으로 청구됩니다.',
  },
];

async function main() {
  let faqData: FaqItem[];

  // Try to load from faq.json, fallback to sample data
  // Look in multiple locations
  const possiblePaths = [
    join(process.cwd(), 'data', 'faq.json'),
    join(process.cwd(), '..', '..', 'data', 'faq.json'), // from packages/vector
  ];

  let faqPath = possiblePaths[0];
  for (const p of possiblePaths) {
    try {
      await readFile(p, 'utf-8');
      faqPath = p;
      break;
    } catch {
      continue;
    }
  }

  try {
    const content = await readFile(faqPath, 'utf-8');
    const rawData = JSON.parse(content);
    // Add id if not present
    faqData = rawData.map((item: any, index: number) => ({
      id: item.id ?? index + 1,
      category: item.category,
      question: item.question,
      answer: item.answer,
    }));
    console.log(`[Seed] Loaded ${faqData.length} items from ${faqPath}`);
  } catch (error) {
    console.log('[Seed] No faq.json found, using sample data');
    faqData = SAMPLE_FAQ;
  }

  await upsertFaqItems(faqData);
}

main().catch(console.error);
