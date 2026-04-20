import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.\n' +
    'Copy .env.example to .env and fill in your Supabase credentials.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession:   true,
    autoRefreshToken: true,
    storageKey:       'courthouse-auth-v2',
    // Anonymous sessions persist across page loads
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
})

/**
 * Call a Supabase Edge Function with the current user's JWT.
 * Throws with a human-readable Arabic error on failure.
 */
export async function callEdgeFunction<T = { ok: boolean; error?: string }>(
  name: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('يجب تسجيل الدخول أولاً')
  }

  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (error) {
    const message = error.message || ''
    console.error(`[callEdgeFunction:${name}]`, error)
    if (message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('CORS')) {
      throw new Error('تعذر الاتصال بالخادم — تأكد من نشر الـ Edge Function وإعدادات CORS')
    }
    throw new Error(message || 'تعذر تنفيذ الطلب')
  }

  const result = (data ?? {}) as Record<string, unknown>
  if (result.ok === false) {
    throw new Error((result.error as string) ?? 'تعذر تنفيذ الطلب')
  }

  return result as T
}
