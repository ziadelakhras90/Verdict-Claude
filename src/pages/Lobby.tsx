import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '@/hooks/useRoom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoomStore } from '@/stores/roomStore'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { useRoomMembership } from '@/hooks/useRoomMembership'
import { usePresence } from '@/hooks/usePresence'
import { useToast } from '@/hooks/useToast'
import { useAuthStore } from '@/stores/authStore'
import { setReady, startGame, leaveRoom } from '@/actions'
import { AppShell } from '@/components/layout'
import { Button, Card, StatusDot, Spinner } from '@/components/ui'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { ConnectionLostOverlay } from '@/components/ui/ConnectionLostOverlay'
import { LobbySkeleton } from '@/components/ui/Skeletons'
import { HostTransferModal } from '@/components/room/HostTransferModal'
import { cn } from '@/lib/utils'
import { ROLE_LABELS } from '@/lib/types'
import type { Role } from '@/lib/types'

export default function Lobby() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate       = useNavigate()
  const currentUserId  = useCurrentUser()
  const toast          = useToast()
  const profile        = useAuthStore(s => s.profile)

  const membership = useRoomMembership(roomId)
  useRoom(roomId)
  useRoomGuard(roomId, 'waiting')
  const { isOnline } = usePresence(roomId, currentUserId, profile?.username)

  const room        = useRoomStore(s => s.room)
  const players     = useRoomStore(s => s.players)
  const isConnected = useRoomStore(s => s.isConnected)

  const [startLoading, setStartLoading] = useState(false)
  const [readyLoading, setReadyLoading] = useState(false)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [copied, setCopied]             = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)

  const me         = players.find(p => p.player_id === currentUserId)
  const isHost     = room?.host_id === currentUserId
  const readyCount = players.filter(p => p.is_ready).length
  const allReady   = players.length >= 4 && players.every(p => p.is_ready)

  function copyCode() {
    if (!room) return
    navigator.clipboard.writeText(room.room_code)
    setCopied(true)
    toast.success('تم نسخ الكود ✓')
    setTimeout(() => setCopied(false), 2000)
  }

  function shareLink() {
    if (!room) return
    navigator.clipboard.writeText(`${window.location.origin}/join/${room.room_code}`)
    toast.success('تم نسخ الرابط ✓')
  }

  async function handleReady() {
    if (!roomId || !me || readyLoading) return
    setReadyLoading(true)
    try { await setReady(roomId, !me.is_ready) }
    catch (err) { toast.error(err instanceof Error ? err.message : 'خطأ') }
    finally { setReadyLoading(false) }
  }

  async function handleStart() {
    if (!roomId || startLoading) return
    if (!allReady) { toast.warn('لم يضغط الجميع جاهز بعد'); return }
    setStartLoading(true)
    try {
      await startGame(roomId)
      // useRoomGuard redirects to /card when status becomes 'starting'
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل بدء اللعبة')
      setStartLoading(false)
    }
  }

  async function handleLeave() {
    if (!roomId || leaveLoading) return
    setLeaveLoading(true)
    try {
      await leaveRoom(roomId)
      useRoomStore.getState().reset()
      navigate('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل المغادرة')
      setLeaveLoading(false)
    }
  }

  if (membership === 'checking') return <AppShell><LobbySkeleton /></AppShell>

  if (membership === 'not_member') return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-4xl">🚫</p>
          <p className="text-parch-300">لستَ عضواً في هذه الغرفة</p>
          <p className="text-xs text-ink-500 animate-pulse">جارٍ التوجيه للرئيسية...</p>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>العودة الآن</Button>
        </div>
      </div>
    </AppShell>
  )

  if (membership === 'room_not_found') return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-4xl">🔍</p>
          <p className="text-parch-300">الغرفة غير موجودة أو انتهت</p>
          <p className="text-xs text-ink-500 animate-pulse">جارٍ التوجيه للرئيسية...</p>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>العودة الآن</Button>
        </div>
      </div>
    </AppShell>
  )

  if (!room) return <AppShell><LobbySkeleton /></AppShell>

  return (
    <AppShell>
      <div className="min-h-screen p-4 py-8">
        <div className="max-w-md mx-auto space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl text-gold">غرفة الانتظار</h1>
              <p className="text-xs text-ink-500 mt-0.5">
                {players.length}/{room.max_players} لاعبين
                {' · '}{readyCount} جاهز
              </p>
            </div>
            <StatusDot connected={isConnected} />
          </div>

          {/* Room Code */}
          <Card className="text-center space-y-3">
            <p className="label-sm">شارك هذا الكود</p>
            <div
              onClick={copyCode}
              className="text-5xl font-mono font-bold tracking-[0.3em] text-gold cursor-pointer hover:text-gold-300 transition-colors select-all"
              title="اضغط لنسخ الكود"
            >
              {room.room_code}
            </div>
            <div className="flex gap-2 justify-center">
              <button onClick={copyCode}
                className="text-xs text-ink-400 hover:text-parch-200 border border-ink-700 hover:border-ink-500 px-3 py-1.5 rounded-lg transition-all">
                {copied ? '✓ تم' : 'نسخ الكود'}
              </button>
              <button onClick={shareLink}
                className="text-xs text-ink-400 hover:text-parch-200 border border-ink-700 hover:border-ink-500 px-3 py-1.5 rounded-lg transition-all">
                🔗 مشاركة الرابط
              </button>
            </div>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'اللاعبون', value: `${players.length}/${room.max_players}` },
              { label: 'مدة الجلسة', value: `${Math.floor(room.session_duration_seconds / 60)}د` },
              { label: 'الجلسات', value: '3' },
            ].map(s => (
              <div key={s.label} className="card-glass rounded-xl p-3 text-center">
                <p className="label-sm mb-1">{s.label}</p>
                <p className="text-gold font-mono text-lg font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Players list */}
          <Card>
            <p className="label-sm mb-3">اللاعبون</p>
            <div className="space-y-2">
              {players.map((p, i) => {
                const username = p.profiles?.username ?? 'لاعب'
                const online   = isOnline(p.player_id)
                const isMe     = p.player_id === currentUserId
                return (
                  <div key={p.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-all animate-fade-up',
                      isMe ? 'border-gold/40 bg-gold/5' : 'border-ink-700/40 bg-ink-800/30'
                    )}
                    style={{ animationDelay: `${i * 50}ms` }}>

                    {/* Avatar with online dot */}
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-parch-100"
                        style={{ background: `hsl(${username.charCodeAt(0) * 19 % 360}, 45%, 28%)` }}>
                        {username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className={cn(
                        'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-ink-900',
                        online ? 'bg-green-400' : 'bg-ink-600'
                      )} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-parch-100 truncate">{username}</span>
                        {isMe && <span className="text-xs text-gold">(أنت)</span>}
                        {p.is_host && <span className="text-xs bg-gold/20 text-gold px-1.5 py-0.5 rounded-full">مضيف</span>}
                      </div>
                    </div>

                    <div className={cn(
                      'text-xs px-2.5 py-1 rounded-full border flex-shrink-0',
                      p.is_ready
                        ? 'text-green-400 border-green-700/40 bg-green-900/20'
                        : 'text-ink-500 border-ink-700/40'
                    )}>
                      {p.is_ready ? '✓ جاهز' : 'انتظار'}
                    </div>
                  </div>
                )
              })}

              {players.length < 4 && (
                <div className="py-3 border border-dashed border-ink-700 rounded-xl text-center">
                  <p className="text-xs text-ink-500">
                    تحتاج {4 - players.length} لاعبين إضافيين على الأقل للبدء
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Action buttons */}
          <div className="space-y-3">
            <Button
              variant={me?.is_ready ? 'ghost' : 'primary'}
              size="lg"
              loading={readyLoading}
              onClick={handleReady}
              className="w-full"
            >
              {me?.is_ready ? '✓ أنا جاهز — اضغط للإلغاء' : 'أنا جاهز ✓'}
            </Button>

            {isHost && (
              <Button
                variant="judge"
                size="lg"
                loading={startLoading}
                disabled={players.length < 4}
                onClick={handleStart}
                className={cn('w-full', allReady && 'animate-pulse-slow')}
              >
                {!allReady
                  ? `انتظار الجاهزية (${readyCount}/${players.length})`
                  : '🔨 ابدأ المحاكمة'}
              </Button>
            )}

            <div className="flex gap-2">
              {isHost && (
                <button
                  onClick={() => setShowTransfer(true)}
                  className="flex-1 text-xs text-ink-600 hover:text-ink-400 transition-colors py-2 border border-ink-800 rounded-lg hover:border-ink-600"
                >
                  نقل صلاحية المضيف
                </button>
              )}
              {!isHost && (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={leaveLoading}
                  onClick={handleLeave}
                  className="flex-1 text-ink-500 hover:text-blood-400 border-ink-700"
                >
                  مغادرة الغرفة
                </Button>
              )}
            </div>
          </div>

        </div>
      </div>

      <HostTransferModal
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        roomId={roomId!}
        players={players}
        currentUserId={currentUserId}
      />
      <ConnectionLostOverlay />
      <ToastContainer />
    </AppShell>
  )
}
