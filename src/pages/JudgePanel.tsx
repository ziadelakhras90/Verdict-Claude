import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '@/hooks/useRoom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoomStore } from '@/stores/roomStore'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { useToast } from '@/hooks/useToast'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import { advanceSession, submitVerdict } from '@/actions'
import { AppShell } from '@/components/layout'
import { Button, Card } from '@/components/ui'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { ConnectionLostOverlay } from '@/components/ui/ConnectionLostOverlay'
import { CountdownRing } from '@/components/game/CountdownRing'
import { EventFeed } from '@/components/game/EventFeed'
import { CaseInfoPanel } from '@/components/game/CaseInfoPanel'
import { GamePhaseBar } from '@/components/game/GamePhaseBar'
import { Modal } from '@/components/ui/Modal'
import { SESSION_LABELS, ROLE_LABELS } from '@/lib/types'
import type { VerdictValue, Role } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function JudgePanel() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate       = useNavigate()
  const currentUserId  = useCurrentUser()
  const toast          = useToast()
  useRoom(roomId)
  useRoomGuard(roomId, ['in_session', 'verdict'])

  const room     = useRoomStore(s => s.room)
  const players  = useRoomStore(s => s.players)
  const events   = useRoomStore(s => s.events)
  const caseInfo = useRoomStore(s => s.caseInfo)
  const { isExpired } = useSessionTimer()

  const [advancing, setAdvancing]     = useState(false)
  const [showVerdict, setShowVerdict] = useState(false)
  const [selectedV, setSelectedV]     = useState<VerdictValue | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [showVerdictConfirm, setShowVerdictConfirm] = useState(false)

  const me      = players.find(p => p.player_id === currentUserId)
  const isJudge = me?.role === 'judge'

  // Ref to track if we've already triggered auto-advance for current expiry
  const autoAdvancedRef = useRef(false)
  const previousExpiredRef = useRef(false)

  // Redirect non-judges away from this panel
  useEffect(() => {
    if (me && !isJudge) {
      navigate(`/room/${roomId}/session`, { replace: true })
    }
  }, [me?.role])

  // Open verdict modal when room enters verdict phase
  useEffect(() => {
    if (room?.status === 'verdict' && isJudge) {
      setShowVerdict(true)
    }
  }, [room?.status, isJudge])

  // Reset auto-advance flag when session changes
  useEffect(() => {
    autoAdvancedRef.current = false
  }, [room?.current_session])

  const handleAdvance = useCallback(async (target: 'next' | 'verdict' = 'next') => {
    if (!roomId || advancing) return
    setAdvancing(true)
    try {
      const result = await advanceSession(roomId, target) as { ok: boolean; next?: string | number; idempotent?: boolean }
      if (result.idempotent) return
      if (result.next === 'verdict') {
        toast.info('تم الانتقال إلى مرحلة الحكم')
      } else if (typeof result.next === 'number') {
        toast.success(`بدأت الجلسة ${result.next}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'فشل الانتقال للجلسة التالية'
      toast.error(message)
      autoAdvancedRef.current = false
    } finally {
      setAdvancing(false)
    }
  }, [roomId, advancing, toast])

  // Auto-advance when timer expires (only fire once per session expiry)
  useEffect(() => {
    if (!room?.session_ends_at) return

    const didJustExpire = !previousExpiredRef.current && isExpired
    previousExpiredRef.current = isExpired

    if (
      didJustExpire &&
      isJudge &&
      room?.status === 'in_session' &&
      !advancing &&
      !autoAdvancedRef.current
    ) {
      autoAdvancedRef.current = true
      handleAdvance('next')
    }
  }, [isExpired, isJudge, room?.status, room?.session_ends_at, advancing, handleAdvance])

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

  if (!room) return null

  const currentSession  = room.current_session
  const sessionDuration = room.session_duration_seconds

  // Speaker counts for this session
  const sessionEvents = events.filter(
    e => e.session_num === currentSession && e.event_type !== 'system'
  )
  const speakerCounts = new Map<string, number>()
  sessionEvents.forEach(e => {
    const u = e.profiles?.username ?? '?'
    speakerCounts.set(u, (speakerCounts.get(u) ?? 0) + 1)
  })

  return (
    <AppShell>
      <div className="h-screen flex flex-col max-w-2xl mx-auto">
        <GamePhaseBar />

        {/* Judge header */}
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

        {/* Case info */}
        {caseInfo && (
          <div className="px-4 py-2.5 border-b border-gold/10 bg-ink-900/40">
            <CaseInfoPanel caseInfo={caseInfo} compact />
          </div>
        )}

        {/* Speaker activity */}
        <div className="px-4 py-2 border-b border-ink-800/40 flex gap-2 flex-wrap min-h-[36px]">
          {players.map(p => {
            const name  = p.profiles?.username ?? '?'
            const count = speakerCounts.get(name) ?? 0
            return (
              <div key={p.player_id}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs',
                  p.role === 'judge'
                    ? 'border-gold/50 bg-gold/10 text-gold'
                    : 'border-ink-700 text-ink-400'
                )}>
                <span>{name}</span>
                {p.role && p.role !== 'judge' && (
                  <span className="text-ink-600 text-[10px]">
                    {ROLE_LABELS[p.role as Role].slice(0, 5)}
                  </span>
                )}
                {count > 0 && (
                  <span className="bg-gold/20 text-gold px-1 rounded-full">{count}</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Events */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <EventFeed events={events} currentSession={currentSession} />
        </div>

        {/* Judge controls */}
        <div className="border-t border-gold/20 p-4 space-y-3 bg-judge/5">
          {room.status === 'in_session' && (
            <div className="space-y-2">
              {currentSession < 3 && (
                <Button
                  variant="judge"
                  size="lg"
                  loading={advancing}
                  onClick={() => handleAdvance('next')}
                  className="w-full"
                >
                  ← الانتقال للجلسة {currentSession + 1}
                </Button>
              )}
              <Button
                variant="danger"
                size="lg"
                loading={advancing}
                onClick={() => setShowVerdictConfirm(true)}
                className="w-full"
              >
                ⚖️ الانتقال مباشرة إلى مرحلة الحكم
              </Button>
            </div>
          )}

          {room.status === 'verdict' && (
            <Button
              variant="danger"
              size="lg"
              onClick={() => setShowVerdict(true)}
              className="w-full"
            >
              🔨 إصدار الحكم النهائي
            </Button>
          )}
        </div>
      </div>


      <Modal
        open={showVerdictConfirm}
        onClose={() => !advancing && setShowVerdictConfirm(false)}
        title="الانتقال إلى الحكم"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-400 text-center">سينتقل الجميع مباشرة إلى مرحلة الحكم، ولن تتمكنوا من العودة للجلسات.</p>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setShowVerdictConfirm(false)} disabled={advancing}>إلغاء</Button>
            <Button variant="danger" className="flex-1" loading={advancing} onClick={async () => { setShowVerdictConfirm(false); await handleAdvance('verdict') }}>تأكيد الانتقال</Button>
          </div>
        </div>
      </Modal>

      {/* Verdict modal */}
      <Modal
        open={showVerdict}
        onClose={() => !submitting && setShowVerdict(false)}
        title="الحكم النهائي"
        size="sm"
      >
        <div className="space-y-5">
          <p className="text-sm text-ink-400 text-center">
            استمعتَ لجميع الأطراف — أصدر حكمك النهائي
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(['innocent', 'guilty'] as VerdictValue[]).map(v => (
              <button
                key={v}
                onClick={() => setSelectedV(v)}
                className={cn(
                  'p-5 rounded-xl border-2 text-center transition-all duration-150 active:scale-95',
                  selectedV === v
                    ? v === 'innocent'
                      ? 'border-blue-400 bg-blue-900/30'
                      : 'border-blood bg-blood/20'
                    : 'border-ink-700 hover:border-ink-500'
                )}>
                <div className="text-3xl mb-1.5">{v === 'innocent' ? '🕊️' : '⛓️'}</div>
                <p className={cn(
                  'font-display text-lg',
                  selectedV === v
                    ? (v === 'innocent' ? 'text-blue-300' : 'text-blood-300')
                    : 'text-parch-300'
                )}>
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
            {selectedV
              ? `تأكيد: ${selectedV === 'innocent' ? 'بريء' : 'مذنب'}`
              : 'اختر الحكم أولاً'}
          </Button>
        </div>
      </Modal>

      <ConnectionLostOverlay />
      <ToastContainer />
    </AppShell>
  )
}
