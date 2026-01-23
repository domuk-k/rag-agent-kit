import { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

// API 에러 메시지 한글화
const errorMessages: Record<string, string> = {
  'Authentication required': '인증이 필요합니다. 토큰을 확인해주세요.',
  'Server configuration error': '서버 설정 오류입니다. 관리자에게 문의하세요.',
  'FAQ not found': '해당 FAQ를 찾을 수 없습니다.',
  'Question and answer are required': '질문과 답변을 모두 입력해주세요.',
};

const translateError = (error: string): string => {
  return errorMessages[error] || error;
};

interface FaqItem {
  id: number;
  category: string;
  subcategory?: string;
  question: string;
  answer: string;
}

interface DailyUsage {
  date: string;
  sessions: number;
  messages: number;
}

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem('adminToken') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('adminToken'));
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [activeTab, setActiveTab] = useState<'faq' | 'analytics'>('faq');
  const [newFaq, setNewFaq] = useState({ category: '', question: '', answer: '' });

  // Edit modal state
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [editForm, setEditForm] = useState({ category: '', question: '', answer: '' });

  // Loading states
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Load FAQs and categories
  const loadData = async () => {
    try {
      const [faqRes, catRes, usageRes] = await Promise.all([
        fetch(`${API_URL}/api/faq`),
        fetch(`${API_URL}/api/faq/categories`),
        fetch(`${API_URL}/api/analytics/daily-usage?days=7`),
      ]);
      setFaqs((await faqRes.json()) as FaqItem[]);
      setCategories((await catRes.json()) as string[]);
      setDailyUsage((await usageRes.json()) as DailyUsage[]);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogin = () => {
    if (token.trim()) {
      localStorage.setItem('adminToken', token);
      setIsAuthenticated(true);
      toast.success('로그인 성공');
    } else {
      toast.error('토큰을 입력해주세요');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
  };

  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    try {
      const res = await fetch(`${API_URL}/api/faq`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newFaq),
      });
      if (res.ok) {
        toast.success('FAQ가 추가되었습니다');
        setNewFaq({ category: '', question: '', answer: '' });
        loadData();
      } else {
        const errData = (await res.json()) as { error: string };
        toast.error(translateError(errData.error));
      }
    } catch {
      toast.error('네트워크 오류가 발생했습니다');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteFaq = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_URL}/api/faq/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success('FAQ가 삭제되었습니다');
        loadData();
      } else {
        const errData = (await res.json()) as { error: string };
        toast.error(translateError(errData.error));
      }
    } catch {
      toast.error('네트워크 오류가 발생했습니다');
    } finally {
      setDeletingId(null);
    }
  };

  const openEditModal = (faq: FaqItem) => {
    setEditingFaq(faq);
    setEditForm({
      category: faq.category,
      question: faq.question,
      answer: faq.answer,
    });
  };

  const closeEditModal = () => {
    setEditingFaq(null);
    setEditForm({ category: '', question: '', answer: '' });
  };

  const handleEditFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaq) return;

    setIsEditing(true);
    try {
      const res = await fetch(`${API_URL}/api/faq/${editingFaq.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        toast.success('FAQ가 수정되었습니다');
        closeEditModal();
        loadData();
      } else {
        const errData = (await res.json()) as { error: string };
        toast.error(translateError(errData.error));
      }
    } catch {
      toast.error('네트워크 오류가 발생했습니다');
    } finally {
      setIsEditing(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-container">
        <Toaster position="top-center" richColors />
        <div className="admin-login">
          <h1>Admin Login</h1>
          <input
            type="password"
            placeholder="Admin Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button onClick={() => handleLogin()}>Login</button>
          <p className="login-hint">환경변수 ADMIN_TOKEN 값을 입력하세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <Toaster position="top-center" richColors />
      <header className="admin-header">
        <h1>RAG Agent Kit Admin</h1>
        <nav>
          <button
            className={activeTab === 'faq' ? 'active' : ''}
            onClick={() => setActiveTab('faq')}
          >
            FAQ 관리
          </button>
          <button
            className={activeTab === 'analytics' ? 'active' : ''}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
          <a href="#/">Chat</a>
          <button className="logout" onClick={handleLogout}>Logout</button>
        </nav>
      </header>

      {activeTab === 'faq' && (
        <div className="admin-content">
          <section className="add-faq">
            <h2>FAQ 추가</h2>
            <form onSubmit={handleAddFaq}>
              <select
                value={newFaq.category}
                onChange={(e) => setNewFaq({ ...newFaq, category: e.target.value })}
                required
              >
                <option value="">카테고리 선택</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="__new__">+ 새 카테고리</option>
              </select>
              {newFaq.category === '__new__' && (
                <input
                  type="text"
                  placeholder="새 카테고리명"
                  onChange={(e) => setNewFaq({ ...newFaq, category: e.target.value })}
                />
              )}
              <input
                type="text"
                placeholder="질문"
                value={newFaq.question}
                onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                required
              />
              <textarea
                placeholder="답변"
                value={newFaq.answer}
                onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                required
              />
              <button type="submit" disabled={isAdding}>
                {isAdding ? '추가 중...' : '추가'}
              </button>
            </form>
          </section>

          <section className="faq-list">
            <h2>FAQ 목록 ({faqs.length}개)</h2>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>카테고리</th>
                  <th>질문</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {faqs.map((faq) => (
                  <tr key={faq.id}>
                    <td>{faq.id}</td>
                    <td>{faq.category}</td>
                    <td title={faq.answer}>{faq.question}</td>
                    <td>
                      <button className="edit" onClick={() => openEditModal(faq)}>
                        수정
                      </button>
                      <button
                        className="delete"
                        onClick={() => handleDeleteFaq(faq.id)}
                        disabled={deletingId === faq.id}
                      >
                        {deletingId === faq.id ? '삭제 중...' : '삭제'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="admin-content">
          <section className="analytics">
            <h2>일별 사용량 (최근 7일)</h2>
            {dailyUsage.length === 0 ? (
              <p>데이터 없음</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>세션</th>
                    <th>메시지</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyUsage.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{d.sessions}</td>
                      <td>{d.messages}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}

      {/* Edit Modal */}
      {editingFaq && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>FAQ 수정</h3>
            <form onSubmit={handleEditFaq}>
              <select
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                required
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="질문"
                value={editForm.question}
                onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                required
              />
              <textarea
                placeholder="답변"
                value={editForm.answer}
                onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                required
              />
              <div className="modal-actions">
                <button type="button" onClick={closeEditModal} disabled={isEditing}>
                  취소
                </button>
                <button type="submit" disabled={isEditing}>
                  {isEditing ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
