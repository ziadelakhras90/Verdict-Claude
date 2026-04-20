import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { advanceSession, submitVerdict } from '@/actions'
import { AppShell } from '@/components/layout'
import { CaseInfoPanel } from '@/components/game/CaseInfoPanel'
import { CountdownRing } from '@/components/game/CountdownRing'
import { EventFeed } from '@/components/game/EventFeed'
import { GamePhaseBar } from '@/components/game/GamePhaseBar'
import { ConnectionLostOverlay } from '@/components/ui/ConnectionLostOverlay'
import { Modal } from '@/components/ui/Modal'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { Button, Card } from '@/components/ui'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoom } from '@/hooks/useRoom'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import { useToast } from '@/hooks/useToast'
import { ROLE_LABELS, SESSION_LABELS } from '@/lib/types'
import type { Role, VerdictValue } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useRoomStore } from '@/stores/roomStore'

export default function JudgePanel() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUserId = useCurrentUser()
  const toast = useToast()
  useRoom(roomId)
  useRoomGuard(roomId, ['in_session', 'verdict'])

  const room = useRoomStore((s) => s.room)
  const players = useRoomStore((s) => s.players)
  const events = useRoomStore((s) => s.events)
  const caseInfo = useRoomStore((s) => s.caseInfo)
  const { isExpired } = useSessionTimer()

  const [advancing, setAdvancing] = useState(false)
  const [showVerdict, setShowVerdict] = useState(false)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const [selectedV, setSelectedV] = useState<VerdictValue | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const me = players.find((p) => p.player_id === currentUserId)
  const isJudge = me?.role === 'judge'
  const autoAdvancedRef = useRef(false)

  useEffect(() => {
    if (me && !isJudge) {
      navigate(`/room/${roomId}/session`, { replace: true })
    }
  }, [me, isJudge, navigate, roomId])

  useEffect(() => {
    if (room?.status === 'verdict' && isJudge) setShowVerdict(true)
  }, [room?.status, isJudge])

  useEffect(() => {
    autoAdvancedRef.current = false
  }, [room?.current_session])

  const handleAdvance = useCallback(
    async (target: 'next' | 'verdict' = 'next') => {
      if (!roomId || !room || advancing) return
      setAdvancing(true)
      try {
        const result = (await advanceSession(roomId, {
          target,
          expectedSession: room.current_session,
        })) as { ok: boolean; next?: string | number; idempotent?: boolean; stale_request?: boolean }

        if (result.stale_request || result.idempotent) return

        if (result.next === 'verdict') {
          toast.info('تم إنهاء الجلسات والانتقال إلى مرحلة الحكم')
        } else if (typeof result.next === 'number') {
          toast.success(`بدأت الجلسة ${result.next}`)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'فشل الانتقال للمرحلة التالية')
      } finally {
        setAdvancing(false)
      }
    },
    [advancing, room, roomId, toast],
  )

  useEffect(() => {
    if (!isExpired || !isJudge || room?.status !== 'in_session' || advancing || autoAdvancedRef.current) return
    autoAdvancedRef.current = true
    void handleAdvance('next')
  }, [advancing, handleAdvance, isExpired, isJudge, room?.status])

  async function handleVerdictSubmit() {
    if (!roomId || !selectedV || submitting) return
    setSubmitting(true)
    try {
      await submitVerdict(roomId, selectedV)
      setShowVerdict(false)
      toast.success('صدر الحكم بنجاح')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل إصدار الحكم')
      setSubmitting(false)
    }
  }

  const currentSession = room?.current_session ?? 1
  const sessionDuration = room?.session_duration_seconds ?? 180

  const sessionEvents = useMemo(
    () => events.filter((e) => e.session_num === currentSession && e.event_type !== 'system'),
    [currentSession, events],
  )

  const speakerCounts = useMemo(() => {
    const counts = new Map<string, number>()
    sessionEvents.forEach((event) => {
      const username = event.profiles?.username ?? '?'
      counts.set(username, (counts.get(username) ?? 0) + 1)
    })
    return counts
  }, [sessionEvents])

  const currentSessionSummary = useMemo(() => {
    return sessionEvents.reduce(
      (acc, event) => {
        if (event.event_type === 'statement' || event.event_type === 'question' || event.event_type === 'objection') {
          acc[event.event_type] += 1
        }
        return acc
      },
      { statement: 0, question: 0, objection: 0 },
    )
  }, [sessionEvents])

  if (!room) return null

  return (
    <AppShell>
      <div className="h-screen flex flex-col max-w-2xl mx-auto">
        <GamePhaseBar />

        <div className="flex items-center gap-4 px-5 py-4 border-b border-gold/20 bg-judge/10">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xl">⚖️</span>
              <span className="label-sm text-gold/70">لوحة القاضي</span>
            </div>
            <p className="font-display text-lg text-gold leading-tight">
              {SESSION_LABELS[currentSession] ?? `الجلسة ${currentSession}`}
            </p>
          </div>
          <CountdownRing totalSeconds={sessionDuration} size={80} />
        </div>

        {caseInfo && (
          <div className="px-4 py-2.5 border-b border-gold/10 bg-ink-900/40">
            <CaseInfoPanel caseInfo={caseInfo} compact />
          </div>
        )}

        <div className="px-4 py-2 border-b border-ink-800/40 flex gap-2 flex-wrap min-h-[36px]">
          {players.map((p) => {
            const name = p.profiles?.username ?? '?'
            const count = speakerCounts.get(name) ?? 0
            return (
              <div
                key={p.player_id}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs',
                  p.role === 'judge' ? 'border-gold/50 bg-gold/10 text-gold' : 'border-ink-700 text-ink-400',
                )}
              >
                <span>{name}</span>
                {p.role && p.role !== 'judge' && (
                  <span className="text-ink-600 text-[10px]">{ROLE_LABELS[p.role as Role].slice(0, 5)}</span>
                )}
                {count > 0 && <span className="bg-gold/20 text-gold px-1 rounded-full">{count}</span>}
              </div>
            )
          })}
        </div>

        <div className="px-4 py-2 border-b border-ink-800/40 flex gap-2 flex-wrap text-xs">
          <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-gold">
            إفادات: {currentSessionSummary.statement}
          </span>
          <span className="rounded-full border border-blue-500/30 bg-blue-900/20 px-2.5 py-1 text-blue-300">
            أسئلة: {currentSessionSummary.question}
          </span>
          <span className="rounded-full border border-blood/30 bg-blood/10 px-2.5 py-1 text-blood-300">
            اعتراضات: {currentSessionSummary.objection}
          </span>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <EventFeed events={events} currentSession={currentSession} />
        </div>

        <div className="border-t border-gold/20 p-4 space-y-3 bg-judge/5">
          {room.status === 'in_session' && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <Button variant="judge" size="lg" loading={advancing} onClick={() => void handleAdvance('next')} className="w-full">
                  {currentSession >= 3 ? '⚖️ إنهاء الجلسات والانتقال للحكم' : `← الانتقال للجلسة ${currentSession + 1}`}
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  disabled={advancing}
                  onClick={() => setShowSkipConfirm(true)}
                  className="w-full border-judge-500/40 text-judge-200 hover:bg-judge/10"
                >
                  ⏭️ الانتقال مباشرة إلى مرحلة الحكم
                </Button>
              </div>
              <Card className="py-3 text-center text-sm text-ink-400">
                يمكنك إنهاء الجلسة الحالية يدويًا في أي وقت، أو القفز مباشرة للحكم إذا اكتملت الصورة لديك.
              </Card>
            </>
          )}

          {room.status === 'verdict' && (
            <Button variant="danger" size="lg" onClick={() => setShowVerdict(true)} className="w-full">
              🔨 إصدار الحكم النهائي
            </Button>
          )}
        </div>
      </div>

      <Modal open={showSkipConfirm} onClose={() => !advancing && setShowSkipConfirm(false)} title="إنهاء الجلسات الآن" size="sm">
        <div className="space-y-4 text-right">
          <p className="text-sm text-parch-200 leading-relaxed">
            هل تريد إنهاء ما تبقى من الجلسات والانتقال مباشرة إلى مرحلة الحكم؟ استخدم هذا الخيار فقط إذا أصبحت الصورة واضحة لديك.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setShowSkipConfirm(false)} disabled={advancing}>
              إلغاء
            </Button>
            <Button
              variant="judge"
              className="flex-1"
              loading={advancing}
              onClick={async () => {
                setShowSkipConfirm(false)
                await handleAdvance('verdict')
              }}
            >
              الانتقال للحكم
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showVerdict} onClose={() => !submitting && setShowVerdict(false)} title="الحكم النهائي" size="sm">
        <div className="space-y-5">
          <p className="text-sm text-ink-400 text-center">استمعتَ لجميع الأطراف — أصدر حكمك النهائي</p>
          <div className="grid grid-cols-2 gap-3">
            {(['innocent', 'guilty'] as VerdictValue[]).map((v) => (
              <button
                key={v}
                onClick={() => setSelectedV(v)}
                className={cn(
                  'p-5 rounded-xl border-2 text-center transition-all duration-150 active:scale-95',
                  selectedV === v
                    ? v === 'innocent'
                      ? 'border-blue-400 bg-blue-900/30'
                      : 'border-blood bg-blood/20'
                    : 'border-ink-700 hover:border-ink-500',
                )}
              >
                <div className="text-3xl mb-1.5">{v === 'innocent' ? '🕊️' : '⛓️'}</div>
                <p
                  className={cn(
                    'font-display text-lg',
                    selectedV === v ? (v === 'innocent' ? 'text-blue-300' : 'text-blood-300') : 'text-parch-300',
                  )}
                >
                  {v === 'innocent' ? 'بريء' : 'مذنب'}
                </p>
              </button>
            ))}
          </div>
          <Button
            variant={selectedV === 'innocent' ? 'ghost' : selectedV === 'guilty' ? 'danger' : 'primary'}
            size="lg"
            loading={submitting}
            disabled={!selectedV}
            onClick={handleVerdictSubmit}
            className="w-full"
          >
            {selectedV ? `تأكيد: ${selectedV === 'innocent' ? 'بريء' : 'مذنب'}` : 'اختر الحكم أولاً'}
          </Button>
        </div>
      </Modal>

      <ConnectionLostOverlay />
      <ToastContainer />
    </AppShell>
  )
}
