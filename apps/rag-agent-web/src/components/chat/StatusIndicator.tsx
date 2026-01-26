import { Search, Sparkles, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatusItem } from '@/lib/extract-data';

interface StatusIndicatorProps {
  statuses: StatusItem[];
  className?: string;
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  'FAQ 검색 중...': Search,
  '응답 생성 중...': Sparkles,
  '답변 작성 중...': Sparkles,
  '처리 중...': Loader2,
  '완료': CheckCircle,
};

const LEVEL_STYLES: Record<StatusItem['level'], string> = {
  loading: 'text-primary animate-pulse',
  info: 'text-muted-foreground',
  success: 'text-green-600 dark:text-green-400',
  error: 'text-destructive',
};

/**
 * 스트리밍 중 상태 표시 컴포넌트
 * - FAQ 검색 중, 응답 생성 중 등의 상태를 시각적으로 표시
 */
export function StatusIndicator({ statuses, className }: StatusIndicatorProps) {
  if (!statuses.length) return null;

  // 가장 최근 상태만 표시 (또는 마지막 loading 상태)
  const lastStatus = statuses[statuses.length - 1];
  const Icon = STATUS_ICONS[lastStatus.status] || Loader2;
  const levelStyle = LEVEL_STYLES[lastStatus.level] || LEVEL_STYLES.info;

  // 완료 상태는 숨김
  if (lastStatus.status === '완료') return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm',
        className
      )}
    >
      <Icon className={cn('h-4 w-4', levelStyle, lastStatus.level === 'loading' && 'animate-spin')} />
      <span className={levelStyle}>{lastStatus.status}</span>
    </div>
  );
}

interface StreamingStatusProps {
  status?: string;
  className?: string;
}

/**
 * 간단한 스트리밍 상태 표시 (로딩 인디케이터 대체)
 */
export function StreamingStatus({ status, className }: StreamingStatusProps) {
  if (!status) return null;

  const Icon = STATUS_ICONS[status] || Loader2;

  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <Icon className="h-4 w-4 animate-spin" />
      <span>{status}</span>
    </div>
  );
}
