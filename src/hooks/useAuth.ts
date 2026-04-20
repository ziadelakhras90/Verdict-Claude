/**
 * useAuth — pure action hook, NO bootstrap logic here.
 * Bootstrap is handled once in AuthProvider (router.tsx).
 * This hook just exposes actions and reactive store state.
 */
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const store = useAuthStore()

  /**
   * Guest sign-in with name only — uses Supabase Anonymous Auth.
   * Requires "Enable anonymous sign-ins" in Supabase Auth settings.
   */
  async function signInAsGuest(username: string): Promise<void> {
    const trimmed = username.trim()
    if (!trimmed)           throw new Error('الاسم مطلوب')
    if (trimmed.length < 2) throw new Error('الاسم قصير جداً — 2 أحرف على الأقل')
    if (trimmed.length > 20) throw new Error('الاسم طويل جداً — 20 حرفاً كحد أقصى')

    const { data, error } = await supabase.auth.signInAnonymously({
      options: { data: { username: trimmed } },
    })

    if (error) {
      // Translate common Supabase errors to Arabic
      if (error.message.includes('Anonymous sign-ins are disabled')) {
        throw new Error('الدخول كضيف غير مفعّل — راجع إعدادات Supabase')
      }
      throw new Error(error.message)
    }

    if (!data.user) throw new Error('فشل الدخول — حاول مجدداً')

    // Upsert profile with chosen username
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .upsert({ id: data.user.id, username: trimmed }, { onConflict: 'id' })
      .select()
      .single()

    if (profileErr) {
      // Username collision — append random suffix
      const suffix = Math.floor(Math.random() * 999)
      const { data: fallback } = await supabase
        .from('profiles')
        .upsert({ id: data.user.id, username: `${trimmed}${suffix}` }, { onConflict: 'id' })
        .select()
        .single()
      store.setProfile(fallback)
    } else {
      store.setProfile(profile)
    }
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
    store.setUser(null)
    store.setProfile(null)
  }

  return {
    user:           store.user,
    profile:        store.profile,
    loading:        store.loading,
    signInAsGuest,
    signOut,
  }
}
