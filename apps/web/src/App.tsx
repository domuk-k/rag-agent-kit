import { useRef, useEffect, useState, useCallback } from 'react';
import Markdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ActionItem {
  label: string;
  query: string;
}

interface SourceItem {
  title: string;
  category: string;
}

const SUGGESTIONS = [
  '정산은 언제 되나요?',
  '상품 등록은 어떻게 하나요?',
  '배송비는 어떻게 설정하나요?',
  '반품/교환 요청은 어떻게 처리하나요?',
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

export default function App() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageContent,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStatus('연결 중...');
    setActions([]);
    setSources([]);
    setError(null);

    const assistantMessageId = `assistant-${Date.now()}`;
    let assistantContent = '';

    try {
      const response = await fetch(`${API_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          ...(sessionId && { sessionId }),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';

      // Add empty assistant message to be filled
      setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));

              switch (event.type) {
                case 'text':
                  assistantContent += event.content;
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMessageId
                        ? { ...m, content: assistantContent }
                        : m
                    )
                  );
                  break;

                case 'status':
                  // Extract session ID from status
                  if (event.status?.startsWith('session:')) {
                    setSessionId(event.status.replace('session:', ''));
                  } else {
                    setStatus(event.level === 'loading' ? event.status : null);
                  }
                  break;

                case 'action':
                  setActions(event.actions || []);
                  break;

                case 'source':
                  setSources(event.sources || []);
                  break;

                case 'error':
                  setError(event.message);
                  break;

                case 'done':
                  setStatus(null);
                  break;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청 실패');
      // Remove empty assistant message on error
      setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
      setStatus(null);
    }
  }, [isLoading, messages, sessionId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const handleActionClick = (query: string) => {
    sendMessage(query);
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div>
          <h1>RAG Agent Kit</h1>
          <p>스마트스토어 FAQ 챗봇</p>
        </div>
        <a href="#/admin" className="admin-link">Admin</a>
      </header>

      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <h2>무엇이 궁금하신가요?</h2>
            <p>
              스마트스토어 관련 질문에 답변해 드립니다.
              <br />
              상품등록, 정산, 배송, 주문, 반품/교환
            </p>
            <div className="suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  className="suggestion"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                {message.role === 'assistant' ? (
                  <Markdown>{message.content}</Markdown>
                ) : (
                  message.content
                )}
              </div>
            ))}

            {/* Sources */}
            {sources.length > 0 && (
              <div className="sources-widget">
                <span className="sources-label">📚 참조:</span>
                {sources.map((source, idx) => (
                  <span key={idx} className="source-tag">
                    {source.category} - {source.title.slice(0, 25)}...
                  </span>
                ))}
              </div>
            )}

            {/* Suggested Actions */}
            {actions.length > 0 && !isLoading && (
              <div className="actions-widget">
                <span className="actions-label">관련 질문:</span>
                <div className="actions-buttons">
                  {actions.map((action, idx) => (
                    <button
                      key={idx}
                      className="action-btn"
                      onClick={() => handleActionClick(action.query)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {isLoading && (
          <div className="message assistant loading-message">
            <div className="typing-indicator">
              <span />
              <span />
              <span />
            </div>
            {status && <span className="status-text">{status}</span>}
          </div>
        )}

        {error && (
          <div className="error-banner">
            ⚠️ {error}
            <button onClick={() => setError(null)}>닫기</button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <form className="input-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="질문을 입력하세요..."
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? '...' : '전송'}
          </button>
        </form>
      </div>
    </div>
  );
}
