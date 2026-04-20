// supabase/functions/advance-session/index.ts
// Only the JUDGE can advance sessions (or the host as fallback).
// @ts-ignore deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json().catch(() => ({}))
    const { roomId, target = 'next' } = body
    if (!roomId) throw new Error('roomId is required')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch room
    const { data: room, error: roomErr } = await admin
      .from('game_rooms').select('*').eq('id', roomId).single()
    if (roomErr || !room) throw new Error('Room not found')

    // Verify caller is judge or host
    const { data: callerPlayer } = await admin
      .from('room_players')
      .select('role, is_host')
      .eq('room_id', roomId)
      .eq('player_id', user.id)
      .single()

    if (!callerPlayer) throw new Error('You are not in this room')
    const isJudge = callerPlayer.role === 'judge'
    const isHost  = callerPlayer.is_host === true

    if (!isJudge && !isHost) {
      throw new Error('Only the judge or host can advance sessions')
    }

    // Idempotent if already advanced
    if (room.status !== 'in_session') {
      return new Response(
        JSON.stringify({ ok: true, idempotent: true, status: room.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const nextSession = room.current_session + 1
    const goToVerdict = target === 'verdict' || nextSession > 3
    let update: Record<string, unknown>
    let systemMsg: string

    if (goToVerdict) {
      update = {
        status: 'verdict',
        current_session: Math.min(room.current_session, 3),
        session_ends_at: null,
      }
      systemMsg = 'انتهت جلسات المحاكمة — القاضي يصدر حكمه الآن'
    } else {
      const sessionEndsAt = new Date(
        Date.now() + room.session_duration_seconds * 1000
      ).toISOString()
      update = {
        current_session: nextSession,
        session_ends_at: sessionEndsAt,
      }
      systemMsg = `بدأت الجلسة ${nextSession}`
    }

    // Optimistic lock: only update if still same session
    const { error: updateErr } = await admin
      .from('game_rooms')
      .update(update)
      .eq('id', roomId)
      .eq('current_session', room.current_session)
      .eq('status', 'in_session')

    if (updateErr) throw new Error('Update failed: ' + updateErr.message)

    // System event (uses service role — bypasses RLS)
    await admin.from('game_events').insert({
      room_id:     roomId,
      player_id:   null,
      event_type:  'system',
      session_num: room.current_session,
      content:     systemMsg,
    })

    console.info(`[advance-session] room=${roomId} session=${room.current_session}→${nextSession}`)

    return new Response(
      JSON.stringify({
        ok: true,
        next: goToVerdict ? 'verdict' : nextSession,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[advance-session] error:', msg)
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
