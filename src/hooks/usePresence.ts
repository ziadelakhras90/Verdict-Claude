import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface PresenceState {
  [userId: string]: { online_at: string; username?: string }
}

/**
 * Tracks which players are currently connected in the room.
 * Uses Supabase Realtime Presence — no DB writes needed.
 */
export function usePresence(roomId: string | undefined, userId: string | null, username?: string) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

  const sync = useCallback((state: PresenceState) => {
    setOnlineUsers(new Set(Object.keys(state)))
  }, [])

  useEffect(() => {
    if (!roomId || !userId) return

    const channel = supabase.channel(`presence:${roomId}`, {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as unknown as PresenceState
        sync(state)
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUsers(prev => new Set([...prev, key]))
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            username,
          })
        }
      })

    // Heartbeat: re-track every 30 s to keep presence alive
    const heartbeat = setInterval(async () => {
      await channel.track({
        online_at: new Date().toISOString(),
        username,
      })
    }, 30_000)

    return () => {
      clearInterval(heartbeat)
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [roomId, userId, username])

  const isOnline = useCallback(
    (uid: string) => onlineUsers.has(uid),
    [onlineUsers]
  )

  return { onlineUsers, isOnline }
}
