import { memo } from 'react';
import type { FaqResultItem } from '@/lib/extract-data';
import { cn } from '@/lib/utils';

interface FaqResultCardProps {
  result: FaqResultItem;
  onClick?: (question: string) => void;
}

/**
 * FAQ 검색 결과 카드
 * - 유사도 점수 배지
 * - 질문 제목
 * - 답변 미리보기
 * - 카테고리 태그
 */
export const FaqResultCard = memo(function FaqResultCard({
  result,
  onClick,
}: FaqResultCardProps) {
  const similarityPercent = Math.round(result.similarity * 100);

  // 유사도에 따른 색상
  const getBadgeColor = (percent: number) => {
    if (percent >= 70) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (percent >= 50) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  };

  // 답변 미리보기 (최대 80자)
  const answerPreview = result.answer.length > 80
    ? result.answer.slice(0, 80) + '...'
    : result.answer;

  return (
    <button
      onClick={() => onClick?.(result.question)}
      className={cn(
        'touch-target w-full text-left p-3 rounded-lg border transition-all',
        'bg-card hover:bg-accent/50 hover:border-primary/30 active:bg-accent/70',
        'focus:outline-none focus:ring-2 focus:ring-primary/20'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-sm font-medium line-clamp-2 flex-1">
          {result.question}
        </span>
        <span className={cn(
          'text-xs font-medium px-1.5 py-0.5 rounded shrink-0',
          getBadgeColor(similarityPercent)
        )}>
          {similarityPercent}%
        </span>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
        {answerPreview}
      </p>

      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
        {result.category}
      </span>
    </button>
  );
});
