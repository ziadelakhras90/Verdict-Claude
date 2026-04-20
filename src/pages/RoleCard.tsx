import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '@/hooks/useRoom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoomStore } from '@/stores/roomStore'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { useToast } from '@/hooks/useToast'
import { fetchMyRoleCard, beginSession } from '@/actions'
import { AppShell } from '@/components/layout'
import { Button, Card, Spinner } from '@/components/ui'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { RoleCardDisplay } from '@/components/game/RoleCardDisplay'
import { CaseInfoPanel } from '@/components/game/CaseInfoPanel'
import type { RoleCard } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function RoleCardPage() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate       = useNavigate()
  const currentUserId  = useCurrentUser()
  const toast          = useToast()
  useRoom(roomId)
  useRoomGuard(roomId, ['starting', 'in_session'])

  const room     = useRoomStore(s => s.room)
  const caseInfo = useRoomStore(s => s.caseInfo)
  const players  = useRoomStore(s => s.players)

  const [card, setCard]           = useState<RoleCard | null>(null)
  const [loading, setLoading]     = useState(true)
  const [beginning, setBeginning] = useState(false)
  const [retries, setRetries]     = useState(0)

  const isHost = room?.host_id === currentUserId

  // Fetch role card with retries (edge function might be slightly delayed)
  useEffect(() => {
    if (!roomId || !currentUserId) return
    let cancelled = false

    async function load() {
      const data = await fetchMyRoleCard(roomId!)
      if (cancelled) return

      if (data) {
        setCard(data as RoleCard)
        setLoading(false)
      } else if (retries < 5) {
        // Retry after a short delay (role assignment might be in progress)
        setTimeout(() => {
          if (!cancelled) setRetries(r => r + 1)
        }, 1200)
      } else {
        setLoading(false)
        toast.error('تأخر تحميل بطاقة الدور — حاول تحديث الصفحة')
      }
    }

    load()
    return () => { cancelled = true }
  }, [roomId, currentUserId, retries])

  // If room status jumped to in_session (e.g. reconnecting after beginSession)
  useEffect(() => {
    if (room?.status === 'in_session' && card) {
      // Small delay to let user see their card
    }
  }, [room?.status, card])

  async function handleBeginSession() {
    if (!roomId) return
    setBeginning(true)
    try {
      await beginSession(roomId)
      // useRoomGuard will redirect to /session automatically
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل بدء الجلسة')
      setBeginning(false)
    }
  }

  if (loading) return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-5xl animate-flicker">🃏</div>
          <Spinner size={28} />
          <p className="text-ink-500 text-sm animate-pulse">
            {retries > 0 ? `جارٍ تحميل بطاقتك... (${retries}/5)` : 'جارٍ تجهيز دورك السري...'}
          </p>
        </div>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      <div className="min-h-screen p-4 py-8 pb-28">
        <div className="max-w-md mx-auto space-y-5">

          <div className="text-center">
            <h1 className="font-display text-2xl text-gold">بطاقة دورك السرية</h1>
            <p className="text-xs text-ink-500 mt-1">اقرأها بعناية — هذه بطاقتك وحدك</p>
          </div>

          {/* Case info */}
          {caseInfo && <CaseInfoPanel caseInfo={caseInfo} />}

          {/* Role card */}
          {card ? (
            <RoleCardDisplay card={card} />
          ) : (
            <Card className="text-center py-10">
              <p className="text-ink-500 text-sm">لا توجد بطاقة لك — تأكد أن اللعبة بدأت</p>
              <Button variant="ghost" size="sm" className="mt-4" onClick={() => setRetries(r => r + 1)}>
                إعادة المحاولة
              </Button>
            </Card>
          )}

          {/* Actions based on status */}
          {room?.status === 'starting' && (
            <div className="space-y-3">
              {isHost ? (
                <>
                  <div className="card-glass rounded-xl p-3 text-center">
                    <p className="text-xs text-ink-400">
                      {players.length} لاعبين في الغرفة — تأكد أن الجميع قرأ بطاقته
                    </p>
                  </div>
                  <Button
                    variant="judge"
                    size="lg"
                    loading={beginning}
                    onClick={handleBeginSession}
                    className="w-full"
                  >
                    {beginning ? 'جارٍ البدء...' : '🔨 ابدأ الجلسة الأولى'}
                  </Button>
                </>
              ) : (
                <Card className="text-center py-5 space-y-2">
                  <div className="flex justify-center">
                    <div className="w-8 h-8 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
                  </div>
                  <p className="text-ink-400 text-sm">المضيف سيبدأ الجلسة قريباً...</p>
                  <p className="text-xs text-ink-600">ستنتقل الصفحة تلقائياً عند البدء</p>
                </Card>
              )}
            </div>
          )}

          {room?.status === 'in_session' && (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => navigate(`/room/${roomId}/session`)}
            >
              انتقل للجلسة ←
            </Button>
          )}

        </div>
      </div>
      <ToastContainer />
    </AppShell>
  )
}
