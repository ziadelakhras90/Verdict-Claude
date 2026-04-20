import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '@/hooks/useRoom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoomStore } from '@/stores/roomStore'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { useToast } from '@/hooks/useToast'
import { revealTruth, fetchResults } from '@/actions'
import { supabase } from '@/lib/supabase'
import { AppShell } from '@/components/layout'
import { Button, Card, Spinner } from '@/components/ui'
import { ConnectionLostOverlay } from '@/components/ui/ConnectionLostOverlay'
import { GamePhaseBar } from '@/components/game/GamePhaseBar'
import { ToastContainer } from '@/components/ui/ToastContainer'
import type { VerdictRow, GameResult } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function Reveal() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate       = useNavigate()
  const currentUserId  = useCurrentUser()
  const toast          = useToast()
  useRoom(roomId)
  useRoomGuard(roomId, ['verdict', 'reveal', 'finished'])

  const room          = useRoomStore(s => s.room)
  const players       = useRoomStore(s => s.players)
  const revealData    = useRoomStore(s => s.revealData)
  const setRevealData = useRoomStore(s => s.setRevealData)
  const setResults    = useRoomStore(s => s.setResults)

  const [verdict, setVerdict]     = useState<VerdictRow | null>(null)
  const [revealing, setRevealing] = useState(false)
  const dataLoadedRef = useRef(false)

  const me        = players.find(p => p.player_id === currentUserId)
  const isHost    = room?.host_id === currentUserId
  const isJudge   = me?.role === 'judge'
  const canReveal = isHost || isJudge

  // Load verdict + existing results whenever room data arrives
  useEffect(() => {
    if (!roomId || !room || dataLoadedRef.current) return
    dataLoadedRef.current = true

    // Always load verdict
    supabase.from('verdicts').select('*').eq('room_id', roomId).single()
      .then(({ data }) => { if (data) setVerdict(data as VerdictRow) })

    // If already revealed (refresh scenario), re-fetch results
    if (room.status === 'reveal' || room.status === 'finished') {
      fetchResults(roomId).then(data => {
        if (data.length) setResults(data as GameResult[])
      })

      // If we have game_results but no revealData in store, reconstruct it
      // by calling reveal-truth idempotently (it returns cached data)
      if (!revealData) {
        revealTruth(roomId)
          .then(r => {
            setRevealData({ actual_verdict: r.actual_verdict, hidden_truth: r.hidden_truth })
          })
          .catch(() => {/* silent — non-host/judge can't call this, that's fine */})
      }
    }
  }, [roomId, room?.status])

  // Navigate to results when room finishes
  useEffect(() => {
    if (room?.status === 'finished') {
      navigate(`/room/${roomId}/results`, { replace: true })
    }
  }, [room?.status])

  async function handleReveal() {
    if (!roomId || revealing) return
    setRevealing(true)
    try {
      const result = await revealTruth(roomId)
      setRevealData({ actual_verdict: result.actual_verdict, hidden_truth: result.hidden_truth })
      const results = await fetchResults(roomId)
      setResults(results as GameResult[])
      toast.success('تم كشف الحقيقة!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطأ في كشف الحقيقة')
      setRevealing(false)
    }
  }

  const verdictMatch = verdict && revealData
    ? verdict.verdict === revealData.actual_verdict
    : null

  return (
    <AppShell>
      <div className="min-h-screen flex flex-col">
        <GamePhaseBar />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md space-y-5 py-8">

            <div className="text-center space-y-1">
              <div className="text-6xl">🔍</div>
              <h1 className="font-display text-4xl text-gold">كشف الحقيقة</h1>
            </div>

            {/* Judge's verdict */}
            {verdict && (
              <Card className="text-center space-y-2 animate-fade-up">
                <p className="label-sm">حكم القاضي</p>
                <p className={cn(
                  'font-display text-4xl',
                  verdict.verdict === 'innocent' ? 'text-blue-300' : 'text-blood-300'
                )}>
                  {verdict.verdict === 'innocent' ? '🕊️ بريء' : '⛓️ مذنب'}
                </p>
              </Card>
            )}

            {/* Revealed truth */}
            {revealData ? (
              <div className="space-y-4 animate-fade-up">
                <Card className="text-center space-y-3">
                  <p className="label-sm">الحقيقة الفعلية</p>
                  <p className={cn(
                    'font-display text-4xl',
                    revealData.actual_verdict === 'innocent' ? 'text-blue-300' : 'text-blood-300'
                  )}>
                    {revealData.actual_verdict === 'innocent' ? '🕊️ بريء فعلاً' : '⛓️ مذنب فعلاً'}
                  </p>
                </Card>

                <Card className="space-y-2">
                  <p className="label-sm">ما جرى فعلاً</p>
                  <p className="text-sm text-parch-200 leading-relaxed">{revealData.hidden_truth}</p>
                </Card>

                {verdictMatch !== null && (
                  <div className={cn(
                    'rounded-2xl p-4 text-center border animate-card-reveal',
                    verdictMatch
                      ? 'border-green-600/40 bg-green-900/20'
                      : 'border-blood/40 bg-blood/10'
                  )}>
                    <p className={cn('font-display text-xl', verdictMatch ? 'text-green-300' : 'text-blood-300')}>
                      {verdictMatch ? '✓ القاضي أصاب الهدف' : '✗ القاضي أخطأ التقدير'}
                    </p>
                  </div>
                )}

                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate(`/room/${roomId}/results`)}
                  className="w-full"
                >
                  عرض النتائج الكاملة →
                </Button>
              </div>
            ) : canReveal ? (
              <Button
                variant="judge"
                size="lg"
                loading={revealing}
                onClick={handleReveal}
                className="w-full"
              >
                🔍 اكشف الحقيقة للجميع
              </Button>
            ) : (
              <Card className="text-center py-10">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
                </div>
                <p className="text-ink-400 text-sm">انتظار كشف الحقيقة...</p>
                <p className="text-xs text-ink-500 mt-1">القاضي أو المضيف سيكشف الحقيقة</p>
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
