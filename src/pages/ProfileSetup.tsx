import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { AppShell } from '@/components/layout'
import { Button, Card } from '@/components/ui'

export default function ProfileSetup() {
  const navigate   = useNavigate()
  const { user, setProfile } = useAuthStore()
  const [username, setUsername] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    // Pre-fill if user has metadata username
    if (user?.user_metadata?.username) {
      setUsername(user.user_metadata.username)
    }
  }, [user])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const name = username.trim()
    if (!name || !user) return

    if (name.length < 2)  { setError('الاسم قصير جداً — 2 أحرف على الأقل'); return }
    if (name.length > 20) { setError('الاسم طويل جداً — 20 حرفاً كحد أقصى'); return }
    if (!/^[\u0600-\u06FFa-zA-Z0-9_\-\.]+$/.test(name)) {
      setError('الاسم يجب أن يحتوي على حروف أو أرقام أو _ أو -')
      return
    }

    setLoading(true)
    setError('')
    try {
      const { data, error: upsertErr } = await supabase
        .from('profiles')
        .upsert({ id: user.id, username: name }, { onConflict: 'id' })
        .select()
        .single()

      if (upsertErr) {
        if (upsertErr.code === '23505') throw new Error('هذا الاسم مأخوذ — جرب اسماً آخر')
        throw upsertErr
      }

      setProfile(data)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحفظ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-xs space-y-6">

          <div className="text-center space-y-2">
            <div className="text-5xl">👤</div>
            <h1 className="font-display text-3xl text-gold">اختر اسمك</h1>
            <p className="text-ink-400 text-sm">
              هذا الاسم سيظهر لجميع اللاعبين
            </p>
          </div>

          <Card>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <label className="label-sm block">اسم اللاعب</label>
                <input
                  ref={inputRef}
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError('') }}
                  placeholder="مثال: القاضي أو sara99"
                  maxLength={20}
                  required
                  dir="rtl"
                  autoComplete="off"
                  className="w-full bg-ink-900 border border-gold/40 text-parch-100
                             px-4 py-3 rounded-xl font-body text-lg text-center
                             focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20
                             placeholder:text-ink-600 transition-all"
                />
                {error && <p className="text-sm text-blood-300 text-center">{error}</p>}
              </div>

              <div className="text-xs text-ink-500 space-y-0.5">
                <p>• بين 2 و 20 حرفاً</p>
                <p>• حروف عربية / إنجليزية أو أرقام أو _ أو -</p>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                disabled={username.trim().length < 2}
                className="w-full"
              >
                حفظ والمتابعة ←
              </Button>
            </form>
          </Card>

        </div>
      </div>
    </AppShell>
  )
}
