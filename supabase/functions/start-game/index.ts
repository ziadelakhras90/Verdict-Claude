// supabase/functions/start-game/index.ts
// Selects a random case, assigns roles, sets room to 'starting'
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
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
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

    // 1. Fetch room and verify host
    const { data: room, error: roomErr } = await admin
      .from('game_rooms').select('*').eq('id', roomId).single()
    if (roomErr || !room) throw new Error('Room not found')
    if (room.host_id !== user.id) throw new Error('فقط المضيف يمكنه بدء اللعبة')

    // Idempotent — if already started, return ok
    if (room.status !== 'waiting') {
      return new Response(
        JSON.stringify({ ok: true, idempotent: true, status: room.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Fetch players
    const { data: players, error: playersErr } = await admin
      .from('room_players').select('player_id, is_ready').eq('room_id', roomId)
    if (playersErr || !players) throw new Error('Failed to fetch players')

    const playerCount = players.length
    if (playerCount < 4) throw new Error(`تحتاج 4 لاعبين على الأقل، يوجد ${playerCount} حالياً`)

    // Check all ready (extra safety — frontend also checks)
    const notReady = players.filter(p => !p.is_ready)
    if (notReady.length > 0) throw new Error(`${notReady.length} لاعبين لم يضغطوا جاهز بعد`)

    // 3. Select random eligible case
    const { data: cases, error: casesErr } = await admin
      .from('case_templates')
      .select('*')
      .eq('is_active', true)
      .lte('min_players', playerCount)
      .gte('max_players', playerCount)

    if (casesErr) throw new Error('فشل جلب القضايا: ' + casesErr.message)
    if (!cases || cases.length === 0) {
      throw new Error(
        `لا توجد قضايا متاحة لـ ${playerCount} لاعبين. ` +
        `أضف قضايا في Supabase تدعم هذا العدد.`
      )
    }

    const selectedCase = cases[Math.floor(Math.random() * cases.length)]

    // 4. Fetch role cards
    const { data: roleCards, error: cardsErr } = await admin
      .from('case_role_cards').select('*').eq('case_id', selectedCase.id)
    if (cardsErr || !roleCards || roleCards.length === 0) {
      throw new Error('لا توجد بطاقات أدوار لهذه القضية: ' + selectedCase.id)
    }

    // 5. Assign roles — ensure judge exists
    const hasJudgeCard = roleCards.some(c => c.role === 'judge')
    if (!hasJudgeCard) throw new Error('القضية لا تحتوي على دور القاضي')

    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5)
    const shuffledRoles   = [...roleCards].sort(() => Math.random() - 0.5)
    const count           = Math.min(shuffledPlayers.length, shuffledRoles.length)

    const assignments = shuffledPlayers.slice(0, count).map((p, i) => ({
      room_id:       roomId,
      player_id:     p.player_id,
      role:          shuffledRoles[i].role,
      private_info:  shuffledRoles[i].private_info,
      win_condition: shuffledRoles[i].win_condition,
      knows_truth:   ['defendant', 'defense_attorney'].includes(shuffledRoles[i].role),
    }))

    // 6. Update room_players with assigned roles
    for (const a of assignments) {
      const { error: roleErr } = await admin
        .from('room_players')
        .update({ role: a.role })
        .eq('room_id', roomId)
        .eq('player_id', a.player_id)
      if (roleErr) console.warn('[start-game] role update error:', roleErr.message)
    }

    // 7. Insert role data (secret cards)
    const { error: insertErr } = await admin
      .from('player_role_data')
      .insert(assignments)
    if (insertErr) throw new Error('Failed to insert role data: ' + insertErr.message)

    // 8. Set room to 'starting' (players read their cards, then host begins session 1)
    const { error: updateErr } = await admin
      .from('game_rooms')
      .update({ case_id: selectedCase.id, status: 'starting' })
      .eq('id', roomId)
      .eq('status', 'waiting') // optimistic lock
    if (updateErr) throw new Error('Failed to update room: ' + updateErr.message)

    console.info(`[start-game] room=${roomId} case="${selectedCase.title}" players=${playerCount}`)

    return new Response(
      JSON.stringify({ ok: true, case_title: selectedCase.title }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[start-game] error:', msg)
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
