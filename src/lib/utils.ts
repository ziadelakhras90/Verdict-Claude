import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

/** Deterministic color from username string */
export function avatarColor(username: string): string {
  const COLORS = [
    '#8B1A1A', '#1A508B', '#8B641A', '#5A1A8B',
    '#1A785A', '#8B4A1A', '#1A708B', '#6B1A8B',
  ]
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) | 0
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Human-readable relative time in Arabic */
export function timeAgo(dateStr: string): string {
  const diffMs   = Date.now() - new Date(dateStr).getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  if (diffSecs < 10)  return 'الآن'
  if (diffSecs < 60)  return `${diffSecs}ث`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60)  return `${diffMins}د`
  const diffHrs  = Math.floor(diffMins / 60)
  return `${diffHrs}س`
}

/** Truncate long text with ellipsis */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trimEnd() + '...'
}

export function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage
  }
  return 'حدث خطأ غير متوقع'
}

export interface EdgeMutationState {
  isIdempotent: boolean
  isStaleRequest: boolean
  isDuplicateLike: boolean
}

export function getEdgeMutationState(result: unknown): EdgeMutationState {
  const payload = (result && typeof result === 'object' ? result : {}) as {
    idempotent?: unknown
    stale_request?: unknown
    staleRequest?: unknown
  }

  const isIdempotent = payload.idempotent === true
  const isStaleRequest = payload.stale_request === true || payload.staleRequest === true

  return {
    isIdempotent,
    isStaleRequest,
    isDuplicateLike: isIdempotent || isStaleRequest,
  }
}
