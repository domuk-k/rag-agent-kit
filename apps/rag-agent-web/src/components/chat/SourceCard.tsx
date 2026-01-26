import { FileText } from 'lucide-react';
import type { SourceItem } from '@/types';

interface SourceCardProps {
  source: SourceItem;
  index?: number;
}

export function SourceCard({ source, index }: SourceCardProps) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
      role="article"
      aria-label={`Source ${index !== undefined ? index + 1 : ''}: ${source.question}`}
    >
      <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{source.category ?? 'FAQ'}</span>
    </div>
  );
}
