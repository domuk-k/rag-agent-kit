import { useState, useEffect, type FormEvent } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import type { FaqItem, FaqFormData, ValidationErrors } from '@/types/admin';
import { VALIDATION_RULES, validateFaq, hasErrors, getCounterClass } from '@/lib/validation';

interface EditModalProps {
  faq: FaqItem;
  categories: string[];
  onClose: () => void;
  onSubmit: (id: number, data: FaqFormData) => Promise<boolean>;
  isSubmitting: boolean;
}

export function EditModal({
  faq,
  categories,
  onClose,
  onSubmit,
  isSubmitting,
}: EditModalProps) {
  const [form, setForm] = useState<FaqFormData>({
    category: faq.category,
    question: faq.question,
    answer: faq.answer,
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [showNewCategory, setShowNewCategory] = useState(false);

  // Update form when faq changes
  useEffect(() => {
    setForm({
      category: faq.category,
      question: faq.question,
      answer: faq.answer,
    });
  }, [faq]);

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

    const success = await onSubmit(faq.id, form);
    if (success) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold">FAQ 수정</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Category */}
          <div className="space-y-1">
            <label className="text-sm font-medium">카테고리</label>
            <select
              value={showNewCategory ? '__new__' : form.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg bg-background ${
                errors.category ? 'border-destructive' : 'border-input'
              }`}
            >
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
            <label className="text-sm font-medium">질문</label>
            <input
              type="text"
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
            <label className="text-sm font-medium">답변</label>
            <textarea
              value={form.answer}
              onChange={(e) => {
                setForm({ ...form, answer: e.target.value });
                if (errors.answer) setErrors({ ...errors, answer: undefined });
              }}
              rows={6}
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

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 border border-input rounded-lg font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSubmitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteModalProps {
  faq: FaqItem;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function DeleteModal({
  faq,
  onClose,
  onConfirm,
  isDeleting,
}: DeleteModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold">FAQ 삭제</h3>
          </div>

          <div className="space-y-3 text-sm">
            <div className="bg-muted/50 p-3 rounded-lg space-y-2">
              <div>
                <span className="text-muted-foreground">카테고리: </span>
                <span>{faq.category}</span>
              </div>
              <div>
                <span className="text-muted-foreground">질문: </span>
                <span>{faq.question}</span>
              </div>
            </div>

            <p className="text-destructive">
              이 FAQ를 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 py-2.5 border border-input rounded-lg font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 py-2.5 bg-destructive text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
