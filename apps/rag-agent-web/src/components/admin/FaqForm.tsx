import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import type { FaqFormData, ValidationErrors } from '@/types/admin';
import { VALIDATION_RULES, validateFaq, hasErrors, getCounterClass } from '@/lib/validation';

interface FaqFormProps {
  categories: string[];
  onSubmit: (data: FaqFormData) => Promise<boolean>;
  isSubmitting: boolean;
}

export function FaqForm({ categories, onSubmit, isSubmitting }: FaqFormProps) {
  const [form, setForm] = useState<FaqFormData>({
    category: '',
    question: '',
    answer: '',
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [showNewCategory, setShowNewCategory] = useState(false);

  const handleCategoryChange = (value: string) => {
    if (value === '__new__') {
      setShowNewCategory(true);
      setForm({ ...form, category: '' });
    } else {
      setShowNewCategory(false);
      setForm({ ...form, category: value });
    }
    if (errors.category) {
      setErrors({ ...errors, category: undefined });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const validationErrors = validateFaq(form);
    setErrors(validationErrors);

    if (hasErrors(validationErrors)) {
      return;
    }

    const success = await onSubmit(form);
    if (success) {
      setForm({ category: '', question: '', answer: '' });
      setShowNewCategory(false);
      setErrors({});
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Plus className="w-5 h-5" />
        FAQ 추가
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Category */}
        <div className="space-y-1">
          <select
            value={showNewCategory ? '__new__' : form.category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg bg-background ${
              errors.category ? 'border-destructive' : 'border-input'
            }`}
          >
            <option value="">카테고리 선택</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
            <option value="__new__">+ 새 카테고리</option>
          </select>
          {errors.category && (
            <p className="text-sm text-destructive">{errors.category}</p>
          )}
        </div>

        {/* New category input */}
        {showNewCategory && (
          <input
            type="text"
            placeholder="새 카테고리명"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background"
          />
        )}

        {/* Question */}
        <div className="space-y-1">
          <input
            type="text"
            placeholder="질문 (5~200자)"
            value={form.question}
            onChange={(e) => {
              setForm({ ...form, question: e.target.value });
              if (errors.question) setErrors({ ...errors, question: undefined });
            }}
            className={`w-full px-3 py-2 border rounded-lg bg-background ${
              errors.question ? 'border-destructive' : 'border-input'
            }`}
          />
          <div className="flex justify-between text-sm">
            {errors.question && (
              <p className="text-destructive">{errors.question}</p>
            )}
            <span
              className={`ml-auto ${getCounterClass(
                form.question.length,
                VALIDATION_RULES.question.max
              )}`}
            >
              {form.question.length}/{VALIDATION_RULES.question.max}
            </span>
          </div>
        </div>

        {/* Answer */}
        <div className="space-y-1">
          <textarea
            placeholder="답변 (10~2000자)"
            value={form.answer}
            onChange={(e) => {
              setForm({ ...form, answer: e.target.value });
              if (errors.answer) setErrors({ ...errors, answer: undefined });
            }}
            rows={4}
            className={`w-full px-3 py-2 border rounded-lg bg-background resize-none ${
              errors.answer ? 'border-destructive' : 'border-input'
            }`}
          />
          <div className="flex justify-between text-sm">
            {errors.answer && (
              <p className="text-destructive">{errors.answer}</p>
            )}
            <span
              className={`ml-auto ${getCounterClass(
                form.answer.length,
                VALIDATION_RULES.answer.max
              )}`}
            >
              {form.answer.length}/{VALIDATION_RULES.answer.max}
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSubmitting ? '추가 중...' : '추가'}
        </button>
      </form>
    </div>
  );
}
