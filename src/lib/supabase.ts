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

  let response: Response
  try {
    response = await fetch(
      `${supabaseUrl}/functions/v1/${name}`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey':        supabaseKey,
        },
        body: JSON.stringify(body),
      }
    )
  } catch (networkErr) {
    console.error(`[callEdgeFunction:${name}] Network error`, networkErr)
    throw new Error('خطأ في الشبكة — تحقق من اتصالك بالإنترنت')
  }

  let result: Record<string, unknown>
  try {
    result = await response.json()
  } catch {
    throw new Error(`الخادم أرجع استجابة غير صالحة (${response.status})`)
  }

  if (!response.ok || result.ok === false) {
    const errMsg = (result.error as string) ?? `خطأ من الخادم (${response.status})`
    console.error(`[callEdgeFunction:${name}]`, errMsg, result)
    throw new Error(errMsg)
  }

  return result as T
}
