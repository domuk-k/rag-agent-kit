import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export function useClipboard(timeout = 2000) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = useCallback(
    async (text: string, id?: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedId(id ?? 'default');
        toast.success('복사되었습니다');

        setTimeout(() => {
          setCopiedId(null);
        }, timeout);
      } catch (error) {
        console.error('Failed to copy:', error);
        toast.error('복사에 실패했습니다');
      }
    },
    [timeout]
  );

  const isCopied = useCallback(
    (id?: string) => copiedId === (id ?? 'default'),
    [copiedId]
  );

  return { copy, isCopied };
}
