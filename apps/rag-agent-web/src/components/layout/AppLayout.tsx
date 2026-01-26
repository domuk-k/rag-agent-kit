import { useEffect } from 'react';
import { Header } from './Header';
import { useConversationStore } from '@/stores/conversation-store';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { initialize } = useConversationStore();

  // Initialize IndexedDB on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
