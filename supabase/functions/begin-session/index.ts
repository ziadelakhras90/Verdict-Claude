// supabase/functions/begin-session/index.ts
// Host triggers this after all players have read their cards.
// Transitions: starting → in_session, starts timer for session 1.
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
    const { roomId } = body
    if (!roomId) throw new Error('roomId is required')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: room, error: roomErr } = await admin
      .from('game_rooms').select('*').eq('id', roomId).single()
    if (roomErr || !room) throw new Error('Room not found')

    // Only host can begin session
    if (room.host_id !== user.id) throw new Error('فقط المضيف يمكنه بدء الجلسة')

    // Idempotent
    if (room.status === 'in_session') {
      return new Response(
        JSON.stringify({ ok: true, idempotent: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (room.status !== 'starting') {
      throw new Error(`الغرفة في حالة غير متوقعة: ${room.status}`)
    }

    const sessionEndsAt = new Date(
      Date.now() + room.session_duration_seconds * 1000
    ).toISOString()

    const { error: updateErr } = await admin
      .from('game_rooms')
      .update({
        status:          'in_session',
        current_session: 1,
        session_ends_at: sessionEndsAt,
      })
      .eq('id', roomId)
      .eq('status', 'starting') // optimistic lock
    if (updateErr) throw new Error('Failed to start session: ' + updateErr.message)

    // System announcement
    await admin.from('game_events').insert({
      room_id:     roomId,
      player_id:   null,
      event_type:  'system',
      session_num: 1,
      content:     'انطلقت المحاكمة ⚖️ — الجلسة الأولى بدأت الآن',
    })

    console.info(`[begin-session] room=${roomId} ends_at=${sessionEndsAt}`)

    return new Response(
      JSON.stringify({ ok: true, session_ends_at: sessionEndsAt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[begin-session] error:', msg)
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
