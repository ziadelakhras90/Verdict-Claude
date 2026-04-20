import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const PREFERRED_NAME_KEY = 'courthouse-preferred-name'

export function getPreferredNameValue() {
  return localStorage.getItem(PREFERRED_NAME_KEY) ?? ''
}

export function useAuth() {
  const { user, profile, loading, setUser, setProfile, setLoading } = useAuthStore()

  async function enterAsGuest(username: string) {
    const trimmed = username.trim()
    if (!trimmed) throw new Error('اسم اللاعب مطلوب')

    const { data: existingSession } = await supabase.auth.getSession()

    if (!existingSession.session) {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) {
        if (error.message?.toLowerCase().includes('anonymous')) {
          throw new Error('فعّل Anonymous Sign-Ins من إعدادات Supabase Auth ثم حاول مرة أخرى')
        }
        throw error
      }
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!userData.user) throw new Error('تعذر إنشاء جلسة ضيف')

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userData.user.id,
          username: trimmed,
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single()

    if (error) throw error

    localStorage.setItem(PREFERRED_NAME_KEY, trimmed)
    setUser(userData.user)
    setProfile(data)
    setLoading(false)
    return data
  }

  function getPreferredName() {
    return getPreferredNameValue()
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setLoading(false)
  }

  return { user, profile, loading, enterAsGuest, getPreferredName, signOut }
}
