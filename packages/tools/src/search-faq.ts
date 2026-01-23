import { tool } from '@openai/agents';
import { searchFaq, formatSearchResults } from '@repo/vector';
import { z } from 'zod';

export const searchFaqTool = tool({
  name: 'searchFaq',
  description: '스마트스토어 FAQ에서 관련 정보를 검색합니다. 사용자 질문에 답하기 전에 반드시 이 도구를 사용하세요.',
  parameters: z.object({
    query: z.string().describe('검색할 질문 또는 키워드'),
    category: z
      .string()
      .nullable()
      .optional()
      .describe('필터링할 카테고리 (상품등록, 정산, 배송, 주문, 반품/교환). null이면 전체 카테고리 검색'),
  }),
  execute: async ({ query, category }) => {
    console.log(`[searchFaqTool] Query: "${query}"${category ? `, Category: ${category}` : ''}`);

    const results = await searchFaq(query, {
      topK: 3,
      minScore: 0.3,
      category: category || undefined, // Convert null to undefined
    });

    console.log(`[searchFaqTool] Found ${results.length} results`);

    return formatSearchResults(results);
  },
});
