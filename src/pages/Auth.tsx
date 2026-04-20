import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/layout'
import { Button } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'

const SUGGESTIONS = ['القاضي', 'المحامي', 'المحقق', 'سارة', 'خالد', 'نورا', 'أحمد', 'الشاهد']

export default function Auth() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { signInAsGuest } = useAuth()
  const { user, profile, loading: authLoading } = useAuthStore()

  const [username, setUsername] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // If already logged in, redirect to original page or home
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/'

  useEffect(() => {
    if (!authLoading && user && profile?.username) {
      navigate(from, { replace: true })
    }
  }, [authLoading, user, profile])

  useEffect(() => {
    if (!authLoading) inputRef.current?.focus()
  }, [authLoading])

  async function handleEnter(e: React.FormEvent) {
    e.preventDefault()
    const name = username.trim()
    if (!name) { setError('أدخل اسمك أولاً'); return }
    setError('')
    setLoading(true)
    try {
      await signInAsGuest(name)
      // Auth state change → AuthProvider → navigate automatically
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ — حاول مجدداً')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl animate-flicker">⚖️</div>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-xs space-y-8">

          <div className="text-center space-y-2">
            <div className="text-6xl animate-flicker select-none">⚖️</div>
            <h1 className="font-display text-4xl text-gold leading-tight">
              قاعة<br/>المحكمة
            </h1>
            <p className="text-ink-500 text-sm">أدخل بالاسم فقط — لا حاجة لبريد إلكتروني</p>
          </div>

          <form onSubmit={handleEnter} className="space-y-4">
            <div className="space-y-2">
              <label className="label-sm block text-center">اسمك في اللعبة</label>
              <input
                ref={inputRef}
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError('') }}
                placeholder="مثال: القاضي أو سارة"
                maxLength={20}
                dir="rtl"
                autoComplete="off"
                autoCapitalize="none"
                className="w-full bg-ink-800 border border-gold/40 text-parch-100
                           px-4 py-3.5 rounded-xl font-body text-lg text-center
                           placeholder:text-ink-600
                           focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20
                           transition-all duration-150"
              />
              {error && <p className="text-sm text-blood-300 text-center">{error}</p>}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={username.trim().length < 2}
              className="w-full"
            >
              {loading ? 'جارٍ الدخول...' : 'دخول ←'}
            </Button>
          </form>

          {/* Name suggestions */}
          <div className="space-y-2">
            <p className="label-sm text-center">اقتراحات سريعة</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setUsername(s); setError(''); inputRef.current?.focus() }}
                  className="text-xs px-3 py-1.5 border border-ink-700 text-ink-400
                             hover:border-gold/40 hover:text-parch-200 rounded-full
                             transition-all duration-100 active:scale-95"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-ink-600 leading-relaxed">
            لا حاجة لتسجيل — جلستك تُحفظ تلقائياً
          </p>

        </div>
      </div>
    </AppShell>
  )
}
