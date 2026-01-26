import { FileText } from 'lucide-react';
import type { SourceItem } from '@/types';
import { cn } from '@/lib/utils';

interface SourceCardProps {
  source: SourceItem;
  index?: number;
}

export function SourceCard({ source, index }: SourceCardProps) {
  const scorePercent = source.score ? Math.round(source.score * 100) : null;

  // Border color based on similarity score
  const getBorderClass = () => {
    if (!scorePercent) return 'border-border';
    if (scorePercent >= 80) return 'border-primary/40';
    if (scorePercent >= 60) return 'border-primary/25';
    return 'border-border';
  };

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-xl border bg-card/50 p-4',
        'transition-colors duration-200',
        getBorderClass()
      )}
      role="article"
      aria-label={`Source ${index !== undefined ? index + 1 : ''}: ${source.question}`}
    >
      {/* Icon */}
      <div className="flex-shrink-0 rounded-lg bg-primary/10 p-2">
        <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-2">
        {/* Question */}
        <h4 className="text-sm font-medium leading-snug text-foreground line-clamp-2">
          {source.question}
        </h4>

        {/* Category */}
        {source.category && (
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {source.category}
          </span>
        )}

        {/* Similarity score */}
        {scorePercent !== null && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">관련도</span>
              <span className="text-xs font-medium text-foreground">{scorePercent}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  scorePercent >= 80 && 'bg-gradient-to-r from-primary to-primary/80',
                  scorePercent >= 60 && scorePercent < 80 && 'bg-gradient-to-r from-primary/80 to-primary/60',
                  scorePercent < 60 && 'bg-gradient-to-r from-primary/60 to-primary/40'
                )}
                style={{ width: `${scorePercent}%` }}
                role="progressbar"
                aria-valuenow={scorePercent}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}
      </div>

      {/* Index badge */}
      {index !== undefined && (
        <div className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm">
          {index + 1}
        </div>
      )}
    </div>
  );
}
