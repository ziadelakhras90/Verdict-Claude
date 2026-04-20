import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useRoom } from '@/hooks/useRoom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoomStore } from '@/stores/roomStore'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { useToast } from '@/hooks/useToast'
import { submitVerdict } from '@/actions'
import { AppShell } from '@/components/layout'
import { Button, Card } from '@/components/ui'
import { ConnectionLostOverlay } from '@/components/ui/ConnectionLostOverlay'
import { GamePhaseBar } from '@/components/game/GamePhaseBar'
import { ToastContainer } from '@/components/ui/ToastContainer'
import type { VerdictValue } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function Verdict() {
  const { id: roomId } = useParams<{ id: string }>()
  const currentUserId  = useCurrentUser()
  const toast          = useToast()
  useRoom(roomId)
  useRoomGuard(roomId, ['verdict', 'reveal', 'finished'])

  const room    = useRoomStore(s => s.room)
  const players = useRoomStore(s => s.players)

  const [selected, setSelected]   = useState<VerdictValue | null>(null)
  const [loading, setLoading]     = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const me      = players.find(p => p.player_id === currentUserId)
  const isJudge = me?.role === 'judge'

  // Already submitted check
  useEffect(() => {
    if (room?.status === 'reveal' || room?.status === 'finished') {
      setSubmitted(true)
    }
  }, [room?.status])

  async function handleSubmit() {
    if (!roomId || !selected || loading) return
    setLoading(true)
    try {
      await submitVerdict(roomId, selected)
      setSubmitted(true)
      toast.success('تم إصدار الحكم بنجاح')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل إصدار الحكم')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="min-h-screen flex flex-col">
        <GamePhaseBar />
        <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6">

          <div className="text-center space-y-2">
            <div className="text-6xl animate-gavel">🔨</div>
            <h1 className="font-display text-4xl shimmer-text">لحظة الحكم</h1>
            <p className="text-ink-400 text-sm">
              {isJudge
                ? 'يا حضرة القاضي — استمعتَ للجميع، أصدر حكمك النهائي'
                : 'انتظار القاضي ليصدر حكمه...'}
            </p>
          </div>

          {/* Judge verdict UI */}
          {isJudge && !submitted && (
            <div className="space-y-4 animate-fade-up">
              <div className="grid grid-cols-2 gap-4">
                {(['innocent', 'guilty'] as VerdictValue[]).map(v => (
                  <button
                    key={v}
                    onClick={() => setSelected(v)}
                    disabled={loading}
                    className={cn(
                      'p-6 rounded-2xl border-2 text-center transition-all duration-150',
                      'active:scale-95 disabled:opacity-50',
                      selected === v
                        ? v === 'innocent'
                          ? 'border-blue-400 bg-blue-900/30 scale-[1.02]'
                          : 'border-blood bg-blood/20 scale-[1.02]'
                        : 'border-ink-700 hover:border-ink-500'
                    )}
                  >
                    <div className="text-4xl mb-2">
                      {v === 'innocent' ? '🕊️' : '⛓️'}
                    </div>
                    <p className={cn(
                      'font-display text-xl',
                      selected === v
                        ? v === 'innocent' ? 'text-blue-300' : 'text-blood-300'
                        : 'text-parch-300'
                    )}>
                      {v === 'innocent' ? 'بريء' : 'مذنب'}
                    </p>
                    <p className="text-xs text-ink-500 mt-1">
                      {v === 'innocent' ? 'إطلاق سراحه' : 'إدانته والحكم عليه'}
                    </p>
                  </button>
                ))}
              </div>

              {selected && (
                <div className={cn(
                  'p-3 rounded-xl border text-center text-sm',
                  selected === 'innocent'
                    ? 'border-blue-700/40 bg-blue-900/10 text-blue-300'
                    : 'border-blood/40 bg-blood/10 text-blood-300'
                )}>
                  اخترتَ: <strong>
                    {selected === 'innocent' ? 'بريء' : 'مذنب'}
                  </strong> — اضغط تأكيد للإصدار النهائي
                </div>
              )}

              <Button
                variant={selected === 'innocent' ? 'ghost' : selected === 'guilty' ? 'danger' : 'primary'}
                size="lg"
                loading={loading}
                disabled={!selected}
                onClick={handleSubmit}
                className="w-full"
              >
                {selected
                  ? `🔨 إصدار الحكم: ${selected === 'innocent' ? 'بريء' : 'مذنب'}`
                  : 'اختر الحكم أولاً'}
              </Button>
            </div>
          )}

          {/* Submitted state */}
          {(submitted || (isJudge && room?.status !== 'verdict')) && (
            <Card className="text-center space-y-3 py-8 animate-fade-up">
              <div className="text-5xl">✅</div>
              <p className="font-display text-2xl text-gold">صدر الحكم</p>
              <p className="text-ink-400 text-sm">
                {isJudge ? 'جارٍ الانتقال لكشف الحقيقة...' : 'تم إصدار الحكم'}
              </p>
            </Card>
          )}

          {/* Waiting state (non-judge) */}
          {!isJudge && !submitted && room?.status === 'verdict' && (
            <Card className="text-center py-10 space-y-4">
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-gold/20 animate-ping" />
                <div className="text-4xl flex items-center justify-center h-full">⏳</div>
              </div>
              <p className="text-parch-300">القاضي يفكر في حكمه...</p>
              <p className="text-xs text-ink-500">ستنتقل الصفحة تلقائياً</p>
            </Card>
          )}

        </div>
      </div>
        </div>
      <ConnectionLostOverlay />
      <ToastContainer />
    </AppShell>
  )
}
