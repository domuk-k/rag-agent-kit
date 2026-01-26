import { useEffect } from 'react';
import { Plus, MessageSquare, Trash2, Loader2, ArrowLeft } from 'lucide-react';
import { useConversationStore } from '@/stores/conversation-store';
import { cn } from '@/lib/utils';

export function Conversations() {
  const {
    conversations,
    currentConversationId,
    isLoading,
    isInitialized,
    initialize,
    createConversation,
    selectConversation,
    deleteConversation,
  } = useConversationStore();

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  const handleNewConversation = async () => {
    await createConversation();
    // Navigate to chat after creating
    window.location.hash = '/';
  };

  const handleSelectConversation = async (id: string) => {
    await selectConversation(id);
    // Navigate to chat after selecting
    window.location.hash = '/';
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
        <a
          href="#/"
          className="rounded-lg p-2 hover:bg-muted"
          aria-label="채팅으로 돌아가기"
        >
          <ArrowLeft className="h-5 w-5" />
        </a>
        <h1 className="text-lg font-semibold">대화 목록</h1>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4">
          {/* New conversation button */}
          <button
            onClick={handleNewConversation}
            disabled={isLoading}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            새 대화 시작하기
          </button>

          {/* Conversation list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="py-12 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                대화가 없습니다
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                새 대화를 시작해보세요
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg border p-4 transition-colors cursor-pointer',
                    currentConversationId === conv.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted'
                  )}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate font-medium">{conv.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(conv.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="rounded-lg p-2 opacity-0 transition-all hover:bg-destructive/10 group-hover:opacity-100"
                    aria-label="대화 삭제"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
