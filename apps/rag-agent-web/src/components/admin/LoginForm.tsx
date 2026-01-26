import { useState, type KeyboardEvent } from 'react';
import { Lock } from 'lucide-react';

interface LoginFormProps {
  onLogin: (token: string) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [token, setToken] = useState('');

  const handleSubmit = () => {
    onLogin(token);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Admin Login</h1>
          <p className="text-muted-foreground text-sm">
            환경변수 ADMIN_TOKEN 값을 입력하세요
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="password"
            placeholder="Admin Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />

          <button
            onClick={handleSubmit}
            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            로그인
          </button>
        </div>

        <div className="text-center">
          <a
            href="#/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            채팅으로 돌아가기
          </a>
        </div>
      </div>
    </div>
  );
}
