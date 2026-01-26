import { useHITLStore } from '@/stores/hitl-store';
import { Shield, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ActionConfirmDialog() {
  const { pendingRequest, addToHistory } = useHITLStore();

  if (!pendingRequest) return null;

  const handleResponse = async (approved: boolean) => {
    try {
      await fetch('/api/hitl/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: pendingRequest.requestId,
          approved,
          sessionId: '', // Will be set by backend
        }),
      });

      addToHistory(pendingRequest, approved);
    } catch (error) {
      console.error('Failed to respond to HITL request:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl bg-background p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900">
            <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold">에이전트 액션 승인 요청</h2>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            에이전트가 다음 작업을 수행하려 합니다:
          </p>

          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary/10 px-2 py-1 text-sm font-mono font-medium text-primary">
                {pendingRequest.toolName}
              </span>
            </div>
            <pre className="mt-3 overflow-x-auto text-sm">
              {JSON.stringify(pendingRequest.toolArgs, null, 2)}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => handleResponse(false)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5',
              'transition-colors hover:bg-muted'
            )}
          >
            <X className="h-4 w-4" />
            거부
          </button>
          <button
            onClick={() => handleResponse(true)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5',
              'bg-primary text-primary-foreground',
              'transition-colors hover:bg-primary/90'
            )}
          >
            <Check className="h-4 w-4" />
            승인
          </button>
        </div>
      </div>
    </div>
  );
}
