import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

type MembershipStatus = 'checking' | 'member' | 'not_member' | 'room_not_found'

/**
 * Verifies the current user is a member of the given room.
 * Uses SECURITY DEFINER RPC to bypass RLS cross-table recursion.
 */
export function useRoomMembership(roomId: string | undefined): MembershipStatus {
  const navigate = useNavigate()
  const [status, setStatus] = useState<MembershipStatus>('checking')

  useEffect(() => {
    if (!roomId) { navigate('/', { replace: true }); return }

    let cancelled = false

    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/auth', { replace: true }); return }

      // is_room_member is SECURITY DEFINER — no RLS recursion issues
      const { data: isMember, error } = await supabase
        .rpc('is_room_member', { p_room_id: roomId })

      if (cancelled) return

      if (error) {
        // RPC error — treat as unknown, let the room page handle it
        console.warn('[useRoomMembership] RPC error:', error.message)
        setStatus('member') // fail open — page will show proper error if needed
        return
      }

      if (isMember === true) {
        setStatus('member')
      } else {
        // Not a member — redirect after short delay
        setStatus('not_member')
        setTimeout(() => { if (!cancelled) navigate('/', { replace: true }) }, 2000)
      }
    }

    check()
    return () => { cancelled = true }
  }, [roomId])

  return status
}
