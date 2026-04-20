import { create } from 'zustand'

const RECENT_TOAST_WINDOW_MS = 1200

export interface ToastItem {
  id:      string
  message: string
  type:    'info' | 'success' | 'error' | 'warn'
}

interface ToastStore {
  toasts: ToastItem[]
  push:   (msg: string, type?: ToastItem['type']) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, type = 'info') => {
    const now = Date.now()
    const duplicate = useToastStore.getState().toasts.some(
      t => t.message === message && t.type === type && now - Number.parseInt(t.id, 36) < RECENT_TOAST_WINDOW_MS
    )
    if (duplicate) return

    const id = now.toString(36)
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3500)
  },
  remove: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

export function useToast() {
  const push = useToastStore(s => s.push)
  return {
    info:    (msg: string) => push(msg, 'info'),
    success: (msg: string) => push(msg, 'success'),
    error:   (msg: string) => push(msg, 'error'),
    warn:    (msg: string) => push(msg, 'warn'),
  }
}
