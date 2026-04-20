import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoomStore } from '@/stores/roomStore'
import type { RoomStatus } from '@/lib/types'

// Map each status to its correct page
const STATUS_ROUTES: Record<RoomStatus, string> = {
  waiting:    'lobby',
  starting:   'card',
  in_session: 'session',
  verdict:    'verdict',
  reveal:     'reveal',
  finished:   'results',
}

/**
 * Redirects to the correct page whenever room status changes away from
 * what this page expects.
 *
 * - Uses a small delay on first load to avoid redirecting before the
 *   room data has been fetched (avoids spurious redirects on refresh).
 */
export function useRoomGuard(
  roomId:  string | undefined,
  current: RoomStatus | RoomStatus[]
) {
  const status   = useRoomStore(s => s.room?.status)
  const navigate = useNavigate()
  const ready    = useRef(false)

  // Mark ready after a short grace period (room data should have loaded)
  useEffect(() => {
    const t = setTimeout(() => { ready.current = true }, 500)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!status || !roomId || !ready.current) return
    const allowed = Array.isArray(current) ? current : [current]
    if (allowed.includes(status)) return
    const target = STATUS_ROUTES[status]
    if (target) navigate(`/room/${roomId}/${target}`, { replace: true })
  }, [status, roomId])
}
