// supabase/functions/submit-event/index.ts
// Submit a session event with server-side validation against room status, session and timer.
// @ts-ignore deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type EventType = 'statement' | 'question' | 'objection'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser()
    if (authErr || !user) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const { roomId, sessionNum, eventType, content } = body as {
      roomId?: string
      sessionNum?: number
      eventType?: EventType
      content?: string
    }

    if (!roomId) throw new Error('roomId is required')
    if (!sessionNum) throw new Error('sessionNum is required')
    if (!eventType || !['statement', 'question', 'objection'].includes(eventType)) {
      throw new Error('نوع المداخلة غير صالح')
    }

    const trimmed = content?.trim() ?? ''
    if (!trimmed) throw new Error('لا يمكن إرسال رسالة فارغة')
    if (trimmed.length > 500) throw new Error('الرسالة طويلة جداً')

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: room, error: roomErr } = await admin
      .from('game_rooms')
      .select('id, status, current_session, session_ends_at')
      .eq('id', roomId)
      .single()

    if (roomErr || !room) throw new Error('Room not found')

    const { data: player, error: playerErr } = await admin
      .from('room_players')
      .select('role')
      .eq('room_id', roomId)
      .eq('player_id', user.id)
      .single()

    if (playerErr || !player) throw new Error('أنت لست داخل هذه الغرفة')
    if (player.role === 'judge') throw new Error('القاضي لا يرسل مداخلات من شاشة اللاعبين')

    if (room.status !== 'in_session') {
      return new Response(JSON.stringify({ ok: false, error: 'انتهت الجلسة الحالية', session_expired: true }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (room.current_session !== sessionNum) {
      return new Response(JSON.stringify({ ok: false, error: 'انتقلت الغرفة إلى جلسة أخرى بالفعل', session_expired: true }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!room.session_ends_at || new Date(room.session_ends_at).getTime() <= Date.now()) {
      return new Response(JSON.stringify({ ok: false, error: 'انتهى وقت الجلسة', session_expired: true }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: insertErr } = await admin.from('game_events').insert({
      room_id: roomId,
      player_id: user.id,
      event_type: eventType,
      session_num: sessionNum,
      content: trimmed,
    })

    if (insertErr) throw new Error('فشل إرسال الرسالة: ' + insertErr.message)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[submit-event] error:', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
