import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '@/hooks/useRoom'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoomStore } from '@/stores/roomStore'
import { useToast } from '@/hooks/useToast'
import { fetchResults, playAgain } from '@/actions'
import { AppShell } from '@/components/layout'
import { Button, Card, Avatar, Badge, Spinner } from '@/components/ui'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { ROLE_LABELS, ROLE_EMOJI } from '@/lib/types'
import type { GameResult, Role } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function Results() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate       = useNavigate()
  const currentUserId  = useCurrentUser()
  const toast          = useToast()
  useRoom(roomId)
  useRoomGuard(roomId, ['reveal', 'finished'])

  const results       = useRoomStore(s => s.results)
  const setResults    = useRoomStore(s => s.setResults)
  const revealData    = useRoomStore(s => s.revealData)

  const [loaded, setLoaded]             = useState(false)
  const [playingAgain, setPlayingAgain] = useState(false)

  useEffect(() => {
    if (!roomId) return
    if (results.length > 0) { setLoaded(true); return }
    fetchResults(roomId).then(data => {
      setResults(data as GameResult[])
      setLoaded(true)
    })
  }, [roomId])

  async function handlePlayAgain() {
    if (!roomId) return
    setPlayingAgain(true)
    try {
      const room = await playAgain(roomId)
      useRoomStore.getState().reset()
      navigate(`/room/${room.id}/lobby`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل إنشاء غرفة جديدة')
      setPlayingAgain(false)
    }
  }

  const winners  = results.filter(r => r.did_win)
  const losers   = results.filter(r => !r.did_win)
  const myResult = results.find(r => r.player_id === currentUserId)

  return (
    <AppShell>
      <div className="min-h-screen px-4 py-10 pb-24">
        <div className="max-w-md mx-auto space-y-6">

          {/* My result */}
          {myResult && (
            <div className={cn(
              'rounded-2xl p-7 text-center border-2 animate-card-reveal',
              myResult.did_win
                ? 'border-gold bg-gradient-to-b from-gold/15 to-gold/5'
                : 'border-ink-700 bg-ink-800/60'
            )}>
              <div className={cn('text-7xl mb-3', myResult.did_win && 'animate-gavel')}>
                {myResult.did_win ? '🏆' : '💀'}
              </div>
              <p className={cn('font-display text-4xl mb-1', myResult.did_win ? 'shimmer-text' : 'text-ink-400')}>
                {myResult.did_win ? 'فزتَ!' : 'خسرتَ'}
              </p>
              <p className="text-sm text-ink-400 mb-3">{myResult.reason}</p>
              <Badge
                label={`${ROLE_EMOJI[myResult.role as Role]} ${ROLE_LABELS[myResult.role as Role]}`}
                color={myResult.did_win ? 'gold' : 'gray'}
              />
            </div>
          )}

          <h1 className="font-display text-2xl text-gold text-center">نتائج المباراة</h1>

          {/* Truth summary */}
          {revealData && (
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="label-sm">الحقيقة الفعلية</p>
                <span className={cn('font-display text-sm',
                  revealData.actual_verdict === 'innocent' ? 'text-blue-300' : 'text-blood-300')}>
                  {revealData.actual_verdict === 'innocent' ? '🕊️ بريء' : '⛓️ مذنب'}
                </span>
              </div>
              <p className="text-xs text-parch-400 leading-relaxed border-t border-ink-700/50 pt-3">
                {revealData.hidden_truth}
              </p>
            </Card>
          )}

          {/* Players results */}
          {!loaded ? (
            <Card className="text-center py-8">
              <Spinner size={24} />
              <p className="text-ink-500 text-sm mt-3">جارٍ تحميل النتائج...</p>
            </Card>
          ) : (
            <>
              {winners.length > 0 && (
                <Card>
                  <p className="label-sm text-green-400 mb-3">🏆 الفائزون ({winners.length})</p>
                  <div className="space-y-2">
                    {winners.map((r, i) => (
                      <ResultRow key={r.player_id} result={r} isMe={r.player_id === currentUserId} won index={i} />
                    ))}
                  </div>
                </Card>
              )}
              {losers.length > 0 && (
                <Card>
                  <p className="label-sm text-ink-500 mb-3">الخاسرون ({losers.length})</p>
                  <div className="space-y-2">
                    {losers.map((r, i) => (
                      <ResultRow key={r.player_id} result={r} isMe={r.player_id === currentUserId} won={false} index={i} />
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}

          <div className="space-y-3">
            <Button variant="primary" size="lg" loading={playingAgain} onClick={handlePlayAgain} className="w-full">
              🎮 لعبة جديدة
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="ghost" onClick={() => navigate('/leaderboard')} className="w-full">🏆 المتصدرون</Button>
              <Button variant="ghost" onClick={() => navigate('/')} className="w-full">🏠 الرئيسية</Button>
            </div>
          </div>

        </div>
      </div>
      <ToastContainer />
    </AppShell>
  )
}

function ResultRow({ result, isMe, won, index }: {
  result: GameResult; isMe: boolean; won: boolean; index: number
}) {
  const username = result.profiles?.username ?? 'لاعب'
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border animate-fade-up',
        isMe ? 'border-gold/30 bg-gold/5' : 'border-ink-700/30 bg-ink-800/20'
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <Avatar username={username} size={38} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-parch-200 truncate">{username}</span>
          {isMe && <span className="text-xs text-gold">(أنت)</span>}
        </div>
        <p className="text-xs text-ink-400">
          {ROLE_EMOJI[result.role as Role]} {ROLE_LABELS[result.role as Role]}
        </p>
        {result.reason && <p className="text-xs text-ink-600 truncate mt-0.5">{result.reason}</p>}
      </div>
      <span className={cn('text-xl flex-shrink-0', won ? 'text-gold' : 'text-ink-600')}>
        {won ? '🏆' : '💀'}
      </span>
    </div>
  )
}
