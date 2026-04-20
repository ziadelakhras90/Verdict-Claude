import { getEdgeMutationState, normalizeErrorMessage } from '@/lib/utils'

export type EdgeMutationKind =
  | 'start-game'
  | 'begin-session'
  | 'advance-session'
  | 'submit-verdict'
  | 'reveal-truth'

export interface EdgeMutationFeedback {
  tone: 'success' | 'info' | 'error'
  message: string
  isDuplicate: boolean
  isStale: boolean
}

const DEFAULT_SUCCESS_MESSAGES: Record<EdgeMutationKind, string> = {
  'start-game': 'تم بدء اللعبة بنجاح',
  'begin-session': 'تم بدء الجلسة',
  'advance-session': 'تم الانتقال للمرحلة التالية',
  'submit-verdict': 'تم إرسال الحكم',
  'reveal-truth': 'تم كشف الحقيقة',
}

const DEFAULT_DUPLICATE_MESSAGES: Record<EdgeMutationKind, string> = {
  'start-game': 'تم تنفيذ بدء اللعبة بالفعل',
  'begin-session': 'تم بدء الجلسة بالفعل',
  'advance-session': 'تم تنفيذ الانتقال بالفعل',
  'submit-verdict': 'تم إرسال الحكم بالفعل',
  'reveal-truth': 'تم كشف الحقيقة بالفعل',
}

const DEFAULT_STALE_MESSAGES: Record<EdgeMutationKind, string> = {
  'start-game': 'تغيرت حالة الغرفة قبل تنفيذ الطلب',
  'begin-session': 'تغيرت حالة الجلسة قبل تنفيذ الطلب',
  'advance-session': 'تغيرت المرحلة قبل تنفيذ الطلب',
  'submit-verdict': 'تم تحديث الحكم أو المرحلة قبل تنفيذ الطلب',
  'reveal-truth': 'تم تحديث مرحلة الكشف قبل تنفيذ الطلب',
}

export function getEdgeMutationFeedback(
  kind: EdgeMutationKind,
  result: unknown,
  options?: { successMessage?: string; duplicateMessage?: string; staleMessage?: string },
): EdgeMutationFeedback {
  const state = getEdgeMutationState(result)

  if (state.isStale) {
    return {
      tone: 'info',
      message: options?.staleMessage ?? DEFAULT_STALE_MESSAGES[kind],
      isDuplicate: state.isDuplicate,
      isStale: state.isStale,
    }
  }

  if (state.isDuplicate) {
    return {
      tone: 'info',
      message: options?.duplicateMessage ?? DEFAULT_DUPLICATE_MESSAGES[kind],
      isDuplicate: state.isDuplicate,
      isStale: state.isStale,
    }
  }

  return {
    tone: 'success',
    message: options?.successMessage ?? DEFAULT_SUCCESS_MESSAGES[kind],
    isDuplicate: false,
    isStale: false,
  }
}

export function getEdgeMutationErrorMessage(error: unknown, fallback?: string): string {
  return normalizeErrorMessage(error, fallback ?? 'تعذر تنفيذ العملية')
}
