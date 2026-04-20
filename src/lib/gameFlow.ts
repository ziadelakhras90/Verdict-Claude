import type { ActiveRoomMembership, Role, RoomStatus } from '@/lib/types'

export function getRoomRouteByStatus(status: RoomStatus, role: Role | null): string {
  switch (status) {
    case 'waiting':
      return 'lobby'
    case 'starting':
      return 'card'
    case 'in_session':
      return role === 'judge' ? 'judge' : 'session'
    case 'verdict':
      return role === 'judge' ? 'judge' : 'verdict'
    case 'reveal':
      return 'reveal'
    case 'finished':
      return 'results'
    default:
      return 'lobby'
  }
}

export function getRoomPath(roomId: string, status: RoomStatus, role: Role | null): string {
  return `/room/${roomId}/${getRoomRouteByStatus(status, role)}`
}

export function shouldRedirectToCanonicalRoomPage(
  pathname: string,
  roomId: string,
  status: RoomStatus,
  role: Role | null,
): boolean {
  return pathname !== getRoomPath(roomId, status, role)
}

export function getActiveRoomPath(membership: ActiveRoomMembership | null | undefined): string | null {
  if (!membership) return null
  const roomId = membership.room_id || membership.roomId
  const room = membership.game_rooms || membership.gameRoom
  if (!roomId || !room) return null
  return getRoomPath(roomId, room.status, membership.role)
}

export function shouldResumeActiveRoom(membership: ActiveRoomMembership | null | undefined): boolean {
  if (!membership) return false
  const room = membership.game_rooms || membership.gameRoom
  if (!room) return false
  return room.status !== 'finished'
}
