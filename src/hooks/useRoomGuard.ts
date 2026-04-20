import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useRoomStore } from '@/stores/roomStore'
import type { RoomStatus } from '@/lib/types'

const STATUS_ROUTES: Record<RoomStatus, string> = {
  waiting: 'lobby',
  starting: 'card',
  in_session: 'session',
  verdict: 'verdict',
  reveal: 'reveal',
  finished: 'results',
}

export function useRoomGuard(roomId: string | undefined, current: RoomStatus | RoomStatus[]) {
  const status = useRoomStore((s) => s.room?.status)
  const players = useRoomStore((s) => s.players)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const navigate = useNavigate()
  const ready = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => {
      ready.current = true
    }, 500)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!status || !roomId || !ready.current) return

    const allowed = Array.isArray(current) ? current : [current]
    if (allowed.includes(status)) return

    const me = players.find((player) => player.player_id === currentUserId)
    const isJudge = me?.role === 'judge'
    const target = isJudge && (status === 'in_session' || status === 'verdict') ? 'judge' : STATUS_ROUTES[status]

    if (target) navigate(`/room/${roomId}/${target}`, { replace: true })
  }, [current, currentUserId, navigate, players, roomId, status])
}
