import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRoomStore } from '@/stores/roomStore'
import type { GameRoom, RoomPlayer, GameEvent, PublicCaseInfo } from '@/lib/types'

/**
 * Subscribes to realtime updates for a room.
 * Fetches initial data and keeps state synchronized.
 *
 * NOTE: Does NOT reset the store on unmount — the store persists while
 * navigating between game pages for the same room. Call store.reset()
 * explicitly when leaving a room entirely.
 */
export function useRoom(roomId: string | undefined) {
  const {
    room: existingRoom,
    setRoom, updateRoom,
    setPlayers, upsertPlayer, updatePlayer,
    addEvent, setEvents,
    setCaseInfo,
    setConnected,
  } = useRoomStore()

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchAll = useCallback(async (forceRefresh = false) => {
    if (!roomId) return

    // Don't re-fetch if we already have data and not forcing
    const needsRefresh = forceRefresh || !existingRoom || existingRoom.id !== roomId

    const [roomRes, playersRes, eventsRes] = await Promise.all([
      supabase.from('game_rooms').select('*').eq('id', roomId).single(),
      supabase.from('room_players')
        .select('*, profiles(username, avatar_url)')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true }),
      needsRefresh
        ? supabase.from('game_events')
            .select('*, profiles(username)')
            .eq('room_id', roomId)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: null }),
    ])

    if (roomRes.data) {
      setRoom(roomRes.data as GameRoom)
      // Fetch case info if available
      if (roomRes.data.case_id) {
        supabase
          .from('public_case_info')
          .select('*')
          .eq('id', roomRes.data.case_id)
          .single()
          .then(({ data }) => { if (data) setCaseInfo(data as PublicCaseInfo) })
      }
    }

    if (playersRes.data) setPlayers(playersRes.data as RoomPlayer[])
    if (eventsRes.data)  setEvents(eventsRes.data as GameEvent[])
  }, [roomId])

  useEffect(() => {
    if (!roomId) return

    // Initial data fetch
    fetchAll(true)

    // Remove any existing channel for this room
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`room-${roomId}`, {
        config: { broadcast: { self: true } },
      })

      // Room status / session changes
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'game_rooms',
        filter: `id=eq.${roomId}`,
      }, async ({ new: updated }) => {
        updateRoom(updated as Partial<GameRoom>)
        const u = updated as Partial<GameRoom>
        if (u.case_id) {
          const { data } = await supabase
            .from('public_case_info').select('*').eq('id', u.case_id).single()
          if (data) setCaseInfo(data as PublicCaseInfo)
        }
      })

      // New player joining
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'room_players',
        filter: `room_id=eq.${roomId}`,
      }, async ({ new: player }) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', (player as RoomPlayer).player_id)
          .single()
        upsertPlayer({ ...(player as RoomPlayer), profiles: profile ?? undefined })
      })

      // Player update (ready, role, etc.)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'room_players',
        filter: `room_id=eq.${roomId}`,
      }, ({ new: updated }) => {
        const p = updated as RoomPlayer
        updatePlayer(p.player_id, {
          is_ready: p.is_ready,
          role:     p.role,
          is_host:  p.is_host,
        })
      })

      // Player leaving
      .on('postgres_changes', {
        event:  'DELETE',
        schema: 'public',
        table:  'room_players',
        filter: `room_id=eq.${roomId}`,
      }, ({ old }) => {
        const p = old as { player_id: string }
        useRoomStore.getState().removePlayer(p.player_id)
      })

      // New game event
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'game_events',
        filter: `room_id=eq.${roomId}`,
      }, async ({ new: event }) => {
        const ev = event as GameEvent
        if (ev.player_id) {
          const { data: profile } = await supabase
            .from('profiles').select('username').eq('id', ev.player_id).single()
          addEvent({ ...ev, profiles: profile ?? undefined })
        } else {
          addEvent(ev)
        }
      })

      .subscribe(status => {
        setConnected(status === 'SUBSCRIBED')
        if (status === 'CHANNEL_ERROR') {
          console.warn('[useRoom] channel error — retrying...')
          setTimeout(() => fetchAll(true), 2000)
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setConnected(false)
    }
  }, [roomId])

  return { fetchAll }
}
