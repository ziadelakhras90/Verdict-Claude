import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type HealthStatus = 'checking' | 'ok' | 'error'

/**
 * Runs a lightweight health check against Supabase on mount.
 * Used by the home page to surface config problems early.
 */
export function useSupabaseHealth() {
  const [status, setStatus]   = useState<HealthStatus>('checking')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        // Lightweight ping — just check auth service is reachable
        const { error } = await supabase.auth.getSession()
        if (cancelled) return
        if (error) {
          setStatus('error')
          setMessage('خطأ في الاتصال: ' + error.message)
        } else {
          setStatus('ok')
        }
      } catch (e) {
        if (!cancelled) {
          setStatus('error')
          setMessage('تعذّر الوصول إلى الخادم — تحقق من بيانات .env')
        }
      }
    }

    check()
    return () => { cancelled = true }
  }, [])

  return { status, message }
}
