import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchMyRoleCard, submitEvent } from '@/actions'
import { AppShell } from '@/components/layout'
import { CaseInfoPanel } from '@/components/game/CaseInfoPanel'
import { EventFeed } from '@/components/game/EventFeed'
import { GamePhaseBar } from '@/components/game/GamePhaseBar'
import { RoleSummaryPanel } from '@/components/game/RoleSummaryPanel'
import { SessionTimer } from '@/components/game/SessionTimer'
import { ConnectionLostOverlay } from '@/components/ui/ConnectionLostOverlay'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { Badge, Button, StatusDot } from '@/components/ui'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoom } from '@/hooks/useRoom'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import { useToast } from '@/hooks/useToast'
import { ROLE_LABELS, SESSION_LABELS } from '@/lib/types'
import type { Role, RoleCard } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useRoomStore } from '@/stores/roomStore'

type EvType = 'statement' | 'question' | 'objection'

const EV_OPTIONS: {
  type: EvType
  label: string
  icon: string
  description: string
  placeholder: string
}[] = [
  {
    type: 'statement',
    label: 'إفادة',
    icon: '🗣️',
    description: 'استخدمها لعرض روايتك أو معلومة تعرفها أو لتثبيت موقفك أمام القاضي.',
    placeholder: 'اكتب إفادتك بوضوح: ماذا حدث؟ وما الذي تريد تثبيته؟',
  },
  {
    type: 'question',
    label: 'سؤال',
    icon: '❓',
    description: 'استخدمه لكشف ثغرة أو إجبار لاعب آخر على توضيح نقطة غامضة.',
    placeholder: 'اكتب سؤالًا مباشرًا: من؟ متى؟ أين؟ ولماذا؟',
  },
  {
    type: 'objection',
    label: 'اعتراض',
    icon: '✋',
    description: 'استخدمه عندما ترى مبالغة أو قفزًا للاستنتاج أو تناقضًا واضحًا.',
    placeholder: 'اكتب اعتراضك واذكر لماذا ترى أن الكلام السابق غير دقيق أو غير كافٍ.',
  },
]

export default function Session() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUserId = useCurrentUser()
  const toast = useToast()
  useRoom(roomId)
  useRoomGuard(roomId, 'in_session')

  const room = useRoomStore((s) => s.room)
  const players = useRoomStore((s) => s.players)
  const events = useRoomStore((s) => s.events)
  const isConnected = useRoomStore((s) => s.isConnected)
  const caseInfo = useRoomStore((s) => s.caseInfo)
  const { isExpired, isUrgent } = useSessionTimer()

  const [text, setText] = useState('')
  const [evType, setEvType] = useState<EvType>('statement')
  const [sending, setSending] = useState(false)
  const [showCase, setShowCase] = useState(false)
  const [showRole, setShowRole] = useState(false)
  const [roleCard, setRoleCard] = useState<(RoleCard & { hints?: unknown }) | null>(null)

  const warnedUrgentRef = useRef(false)
  const warnedExpiredRef = useRef(false)

  const me = players.find((p) => p.player_id === currentUserId)
  const isJudge = me?.role === 'judge'
  const charLeft = 300 - text.length
  const currentOption = EV_OPTIONS.find((opt) => opt.type === evType) ?? EV_OPTIONS[0]

  const sessionEvents = useMemo(
    () => events.filter((event) => event.session_num === room?.current_session),
    [events, room?.current_session],
  )

  const eventTypeCounts = useMemo(() => {
    return sessionEvents.reduce(
      (acc, event) => {
        if (event.event_type === 'system') return acc
        acc[event.event_type] += 1
        return acc
      },
      { statement: 0, question: 0, objection: 0 },
    )
  }, [sessionEvents])

  useEffect(() => {
    if (isJudge && roomId) {
      navigate(`/room/${roomId}/judge`, { replace: true })
    }
  }, [isJudge, roomId, navigate])

  useEffect(() => {
    if (!roomId) return
    let ignore = false
    fetchMyRoleCard(roomId).then((data) => {
      if (!ignore && data) setRoleCard(data as RoleCard)
    })
    return () => {
      ignore = true
    }
  }, [roomId])

  useEffect(() => {
    if (isUrgent && !warnedUrgentRef.current) {
      warnedUrgentRef.current = true
      toast.warn('تبقّى 30 ثانية فقط — ركّز على أهم نقطة لديك')
    }
    if (!isUrgent) warnedUrgentRef.current = false
  }, [isUrgent, toast])

  useEffect(() => {
    if (isExpired && !warnedExpiredRef.current) {
      warnedExpiredRef.current = true
      setText('')
      toast.info('انتهى وقت الجلسة — تم إغلاق الإرسال وانتظر قرار القاضي')
    }
    if (!isExpired) warnedExpiredRef.current = false
  }, [isExpired, toast])

  useEffect(() => {
    setText('')
    setEvType('statement')
  }, [room?.current_session])

  async function handleSend() {
    if (!roomId || !text.trim() || !room || isExpired || sending) return
    setSending(true)
    try {
      await submitEvent(roomId, room.current_session, text.trim(), evType)
      setText('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'فشل الإرسال'
      toast.error(message)
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  if (!room) return null

  return (
    <AppShell>
      <div className="h-screen flex flex-col max-w-2xl mx-auto">
        <GamePhaseBar />

        <div
          className={cn(
            'flex items-center gap-3 px-4 py-3 border-b transition-colors duration-500',
            isUrgent ? 'border-blood/30 bg-blood/5' : 'border-gold/10',
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {me?.role && <Badge label={ROLE_LABELS[me.role as Role]} color="gold" />}
              <StatusDot connected={isConnected} />
            </div>
            <p className="text-xs text-ink-500 mt-0.5 truncate">
              {SESSION_LABELS[room.current_session] ?? `الجلسة ${room.current_session}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SessionTimer />
            <button
              onClick={() => setShowRole((v) => !v)}
              title="عرض بطاقتك"
              className={cn(
                'text-xs border rounded-lg px-2.5 py-1.5 transition-all',
                showRole
                  ? 'border-gold/50 bg-gold/10 text-gold'
                  : 'border-ink-700 text-ink-500 hover:border-gold/40 hover:text-gold',
              )}
            >
              🗡️
            </button>
            <button
              onClick={() => setShowCase((v) => !v)}
              title="عرض تفاصيل القضية"
              className={cn(
                'text-xs border rounded-lg px-2.5 py-1.5 transition-all',
                showCase
                  ? 'border-gold/50 bg-gold/10 text-gold'
                  : 'border-ink-700 text-ink-500 hover:border-gold/40 hover:text-gold',
              )}
            >
              📋
            </button>
          </div>
        </div>

        {showRole && roleCard && (
          <div className="border-b border-gold/10 px-4 py-3 bg-ink-900/70 animate-fade-up max-h-[45vh] overflow-y-auto">
            <RoleSummaryPanel card={roleCard} caseInfo={caseInfo} compact />
          </div>
        )}

        {showCase && caseInfo && (
          <div className="border-b border-gold/10 px-4 py-3 bg-ink-900/60 animate-fade-up">
            <CaseInfoPanel caseInfo={caseInfo} compact />
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col">
          <EventFeed events={events} currentSession={room.current_session} />
        </div>

        {isExpired && (
          <div className="px-4 py-2 bg-ink-800/80 border-t border-ink-700/40 text-center">
            <p className="text-xs text-ink-500 animate-pulse">
              انتهى وقت الجلسة — تم إغلاق الإرسال وانتظر قرار القاضي
            </p>
          </div>
        )}

        <div
          className={cn(
            'border-t p-4 space-y-3 transition-colors duration-300',
            isExpired ? 'border-ink-800 bg-ink-900/60' : 'border-gold/10 bg-ink-900/80',
          )}
        >
          <div className="grid grid-cols-3 gap-2">
            {EV_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                onClick={() => setEvType(opt.type)}
                disabled={isExpired}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-2 text-xs font-body border rounded-lg transition-all duration-150 disabled:opacity-40',
                  evType === opt.type
                    ? 'border-gold/50 bg-gold/10 text-gold'
                    : 'border-ink-700/50 text-ink-500 hover:border-ink-600',
                )}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
                <span className="text-[10px] text-ink-500">{eventTypeCounts[opt.type]}</span>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-gold/10 bg-black/20 px-3 py-2 text-xs text-parch-200">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-gold">{currentOption.label}</span>
              <span className="text-ink-500">{currentOption.icon}</span>
            </div>
            <p>{currentOption.description}</p>
          </div>

          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 300))}
              onKeyDown={onKeyDown}
              placeholder={isExpired ? 'الجلسة انتهت' : currentOption.placeholder}
              disabled={isExpired}
              rows={3}
              className={cn(
                'w-full bg-ink-800 border text-parch-100 px-3 py-2.5 rounded-xl',
                'font-body text-sm placeholder:text-ink-600 focus:outline-none resize-none',
                isExpired
                  ? 'border-ink-800 opacity-40 cursor-not-allowed'
                  : 'border-gold/20 focus:border-gold/50 transition-colors',
              )}
              dir="rtl"
            />
            {text.length > 0 && (
              <span
                className={cn(
                  'absolute bottom-2 left-3 text-xs pointer-events-none',
                  charLeft < 30 ? 'text-blood-400' : 'text-ink-600',
                )}
              >
                {charLeft}
              </span>
            )}
          </div>

          <Button
            variant="primary"
            onClick={handleSend}
            loading={sending}
            disabled={!text.trim() || isExpired}
            className="w-full"
          >
            إرسال {currentOption.icon}
          </Button>
        </div>
      </div>

      <ConnectionLostOverlay />
      <ToastContainer />
    </AppShell>
  )
}
