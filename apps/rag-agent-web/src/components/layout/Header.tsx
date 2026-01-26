import { Moon, Sun, Monitor, MessageSquare, Settings } from 'lucide-react';
import { useThemeStore } from '@/stores/theme-store';
import { useConversationStore } from '@/stores/conversation-store';
import { cn } from '@/lib/utils';

export function Header() {
  const { theme, setTheme } = useThemeStore();
  const { startNewChat } = useConversationStore();

  const themeOptions = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ];

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <button
        onClick={() => {
          startNewChat();
          window.location.hash = '#/';
        }}
        className="text-lg font-semibold hover:text-primary transition-colors"
      >
        FAQ 챗봇
      </button>

      <div className="flex items-center gap-2">
        {/* Navigation buttons */}
        <nav className="flex items-center gap-1">
          <a
            href="#/conversations"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="대화 목록"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">대화목록</span>
          </a>
          <a
            href="#/admin"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="관리자"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">관리</span>
          </a>
        </nav>

        {/* Theme toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          {themeOptions.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                'rounded-md p-2 transition-colors',
                theme === value ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
              aria-label={label}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
