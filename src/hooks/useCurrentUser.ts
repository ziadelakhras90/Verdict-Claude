import { useAuthStore } from '@/stores/authStore'

export function useCurrentUser() {
  return useAuthStore((state) => state.user?.id ?? null)
}
