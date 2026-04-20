import { useAuthStore } from '@/stores/authStore'

/**
 * Returns the current user's ID synchronously from the auth store.
 * Avoids async delays that could cause brief null values and missed player matching.
 */
export function useCurrentUser(): string | null {
  return useAuthStore(s => s.user?.id ?? null)
}
