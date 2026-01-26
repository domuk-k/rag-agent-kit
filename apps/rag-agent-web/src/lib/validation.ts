import type { FaqFormData, ValidationErrors } from '@/types/admin';

export const VALIDATION_RULES = {
  question: { min: 5, max: 200 },
  answer: { min: 10, max: 2000 },
} as const;

/**
 * Validate FAQ form data
 */
export function validateFaq(data: FaqFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  // Category validation
  if (!data.category || data.category === '__new__') {
    errors.category = '카테고리를 선택해주세요';
  }

  // Question validation
  if (!data.question.trim()) {
    errors.question = '질문을 입력해주세요';
  } else if (data.question.length < VALIDATION_RULES.question.min) {
    errors.question = `질문은 최소 ${VALIDATION_RULES.question.min}자 이상이어야 합니다`;
  } else if (data.question.length > VALIDATION_RULES.question.max) {
    errors.question = `질문은 ${VALIDATION_RULES.question.max}자를 초과할 수 없습니다`;
  }

  // Answer validation
  if (!data.answer.trim()) {
    errors.answer = '답변을 입력해주세요';
  } else if (data.answer.length < VALIDATION_RULES.answer.min) {
    errors.answer = `답변은 최소 ${VALIDATION_RULES.answer.min}자 이상이어야 합니다`;
  } else if (data.answer.length > VALIDATION_RULES.answer.max) {
    errors.answer = `답변은 ${VALIDATION_RULES.answer.max}자를 초과할 수 없습니다`;
  }

  return errors;
}

/**
 * Get CSS class for character counter based on usage ratio
 */
export function getCounterClass(current: number, max: number): string {
  const ratio = current / max;
  if (ratio >= 0.95) return 'text-destructive';
  if (ratio >= 0.8) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-muted-foreground';
}

/**
 * Check if validation errors object has any errors
 */
export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * API error message translation
 */
const errorMessages: Record<string, string> = {
  'Authentication required': '인증이 필요합니다. 토큰을 확인해주세요.',
  'Server configuration error': '서버 설정 오류입니다. 관리자에게 문의하세요.',
  'FAQ not found': '해당 FAQ를 찾을 수 없습니다.',
  'Question and answer are required': '질문과 답변을 모두 입력해주세요.',
};

export function translateError(error: string): string {
  return errorMessages[error] || error;
}
