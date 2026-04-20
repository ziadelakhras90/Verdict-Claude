import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout'
import { Button, Card, Spinner } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/hooks/useToast'
import { useSupabaseHealth } from '@/hooks/useSupabaseHealth'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { joinRoom } from '@/actions'

export default function Home() {
  const navigate            = useNavigate()
  const { user, profile }   = useAuthStore()
  const displayName = profile?.username?.trim() || user?.user_metadata?.username?.trim() || '...'
  const toast               = useToast()
  const { status: health, message: healthMsg } = useSupabaseHealth()

  const [joinCode, setJoinCode]       = useState('')
  const [joining, setJoining]         = useState(false)
  const [showJoinBox, setShowJoinBox] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  async function handleQuickJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { navigate('/auth'); return }
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) return
    setJoining(true)
    try {
      const room = await joinRoom(code)
      navigate(`/room/${room.id}/lobby`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل الانضمام')
    } finally {
      setJoining(false)
    }
  }

  function openJoinBox() {
    setShowJoinBox(true)
    setTimeout(() => codeRef.current?.focus(), 50)
  }

  return (
    <AppShell>
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">

        {/* Background columns */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          {[10, 50, 90].map(x => (
            <div key={x} className="absolute top-0 bottom-0 w-px opacity-[0.07]"
              style={{ left: `${x}%`, background: 'linear-gradient(to bottom, transparent, #C9A84C 30%, #C9A84C 70%, transparent)' }} />
          ))}
        </div>

        <div className="relative z-10 w-full max-w-sm space-y-10 text-center">

          {/* Health warning */}
          {health === 'error' && (
            <div className="bg-blood/15 border border-blood/40 rounded-xl px-4 py-3 text-sm text-blood-300 text-center">
              ⚠️ {healthMsg || 'تعذّر الاتصال بالخادم'}
            </div>
          )}

          {/* Logo */}
          <div className="space-y-3">
            <div className="text-7xl animate-flicker select-none">⚖️</div>
            <h1 className="font-display text-6xl shimmer-text leading-none">
              قاعة<br />المحكمة
            </h1>
            <p className="text-ink-400 font-body text-sm tracking-wide">
              لعبة أدوار · محاكمة · خداع · 4–8 لاعبين
            </p>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold/30" />
            <span className="text-gold/30 text-xs">◆ ◆ ◆</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold/30" />
          </div>

          {/* Main actions */}
          {!user ? (
            <div className="space-y-3">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={health === 'checking'}
                onClick={() => navigate('/auth')}
              >
                {health === 'checking' ? <Spinner size={18} /> : 'ابدأ اللعب ←'}
              </Button>
              <p className="text-xs text-ink-600">دخول بالاسم فقط · لا حاجة لبريد إلكتروني</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink-400">
                أهلاً، <span className="text-gold font-semibold">{displayName}</span>
              </p>

              {showJoinBox ? (
                <form onSubmit={handleQuickJoin} className="space-y-2">
                  <input
                    ref={codeRef}
                    type="text"
                    value={joinCode}
                    onChange={e => setJoinCode(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
                    )}
                    placeholder="ABC123"
                    maxLength={6}
                    className="w-full bg-ink-800 border border-gold/40 text-gold text-center
                               text-3xl font-mono font-bold tracking-[0.4em] py-3 rounded-xl
                               focus:outline-none focus:border-gold uppercase"
                    dir="ltr"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" variant="primary" loading={joining}
                      disabled={joinCode.length !== 6} className="flex-1">انضم</Button>
                    <Button type="button" variant="ghost"
                      onClick={() => { setShowJoinBox(false); setJoinCode('') }}
                      className="flex-1">إلغاء</Button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="primary" onClick={() => navigate('/create')} className="w-full">
                    إنشاء غرفة
                  </Button>
                  <Button variant="ghost" onClick={openJoinBox} className="w-full">
                    انضمام
                  </Button>
                </div>
              )}

              <div className="flex justify-center gap-4 pt-1">
                <button onClick={() => navigate('/leaderboard')}
                  className="text-xs text-ink-600 hover:text-gold transition-colors">
                  🏆 المتصدرون
                </button>
                <button onClick={() => navigate('/profile')}
                  className="text-xs text-ink-600 hover:text-ink-400 transition-colors">
                  👤 حسابي
                </button>
                <button onClick={() => navigate('/admin')}
                  className="text-xs text-ink-600 hover:text-ink-400 transition-colors">
                  ⚙️ إدارة
                </button>
              </div>
            </div>
          )}

          {/* How to play */}
          <Card className="text-right space-y-2.5">
            <p className="label-sm text-center mb-3">كيف تلعب</p>
            {[
              ['🚪', 'أنشئ غرفة أو انضم بكود'],
              ['🃏', 'كل لاعب يحصل على دور سري'],
              ['🗣️', 'ثلاث جلسات للحجج والشهادات'],
              ['🔨', 'القاضي يصدر حكمه'],
              ['🔍', 'تُكشف الحقيقة — من فاز؟'],
            ].map(([icon, text]) => (
              <div key={text as string} className="flex items-start gap-3 text-sm text-parch-300">
                <span className="mt-0.5 flex-shrink-0 w-5">{icon as string}</span>
                <span>{text as string}</span>
              </div>
            ))}
          </Card>

        </div>
      </div>
      <ToastContainer />
    </AppShell>
  )
}
