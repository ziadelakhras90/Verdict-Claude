// supabase/functions/start-game/index.ts
// Selects a random case, assigns roles, sets room to 'starting'
// @ts-ignore deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function formatHints(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return ''
  const lines = Object.entries(raw as Record<string, unknown>).flatMap(([key, value]) => {
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => `- ${key}: ${item}`)
    }
    if (typeof value === 'string' && value.trim()) {
      return [`- ${key}: ${value}`]
    }
    return []
  })
  return lines.length ? `\n\nملاحظات إضافية لك:\n${lines.join('\n')}` : ''
}

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
      error: authError,
    } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const { roomId } = body
    if (!roomId) throw new Error('roomId is required')

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: room, error: roomErr } = await admin.from('game_rooms').select('*').eq('id', roomId).single()
    if (roomErr || !room) throw new Error('Room not found')
    if (room.host_id !== user.id) throw new Error('فقط المضيف يمكنه بدء اللعبة')

    if (room.status !== 'waiting') {
      return new Response(JSON.stringify({ ok: true, idempotent: true, status: room.status }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: players, error: playersErr } = await admin
      .from('room_players')
      .select('player_id, is_ready')
      .eq('room_id', roomId)

    if (playersErr || !players) throw new Error('Failed to fetch players')

    const playerCount = players.length
    if (playerCount < 4) throw new Error(`تحتاج 4 لاعبين على الأقل، يوجد ${playerCount} حالياً`)

    const notReady = players.filter((p) => !p.is_ready)
    if (notReady.length > 0) throw new Error(`${notReady.length} لاعبين لم يضغطوا جاهز بعد`)

    const { data: cases, error: casesErr } = await admin
      .from('case_templates')
      .select('*')
      .eq('is_active', true)
      .lte('min_players', playerCount)
      .gte('max_players', playerCount)

    if (casesErr) throw new Error('فشل جلب القضايا: ' + casesErr.message)
    if (!cases || cases.length === 0) {
      throw new Error(`لا توجد قضايا متاحة لـ ${playerCount} لاعبين. أضف قضايا في Supabase تدعم هذا العدد.`)
    }

    const caseIds = cases.map((entry) => entry.id)
    const { data: allRoleCards, error: cardsErr } = await admin
      .from('case_role_cards')
      .select('*')
      .in('case_id', caseIds)

    if (cardsErr || !allRoleCards?.length) {
      throw new Error('لا توجد بطاقات أدوار لهذه القضايا')
    }

    const grouped = new Map<string, typeof allRoleCards>()
    for (const card of allRoleCards) {
      const existing = grouped.get(card.case_id) ?? []
      existing.push(card)
      grouped.set(card.case_id, existing)
    }

    const eligibleCases = cases.filter((entry) => {
      const cards = grouped.get(entry.id) ?? []
      return cards.length === playerCount && cards.some((card) => card.role === 'judge')
    })

    if (!eligibleCases.length) {
      throw new Error(`لا توجد قضية مجهزة بعدد بطاقات يطابق ${playerCount} لاعبًا بالضبط.`)
    }

    const selectedCase = eligibleCases[Math.floor(Math.random() * eligibleCases.length)]
    const roleCards = [...(grouped.get(selectedCase.id) ?? [])]

    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5)
    const shuffledRoles = [...roleCards].sort(() => Math.random() - 0.5)

    const assignments = shuffledPlayers.map((player, index) => {
      const roleCard = shuffledRoles[index]
      return {
        room_id: roomId,
        player_id: player.player_id,
        role: roleCard.role,
        private_info: `${roleCard.private_info}${formatHints(roleCard.hints)}`,
        win_condition: roleCard.win_condition,
        knows_truth: ['defendant', 'defense_attorney'].includes(roleCard.role),
      }
    })

    for (const assignment of assignments) {
      const { error: roleErr } = await admin
        .from('room_players')
        .update({ role: assignment.role })
        .eq('room_id', roomId)
        .eq('player_id', assignment.player_id)
      if (roleErr) console.warn('[start-game] role update error:', roleErr.message)
    }

    const { error: insertErr } = await admin
      .from('player_role_data')
      .upsert(assignments, { onConflict: 'room_id,player_id' })
    if (insertErr) throw new Error('Failed to insert role data: ' + insertErr.message)

    const { error: updateErr } = await admin
      .from('game_rooms')
      .update({ case_id: selectedCase.id, status: 'starting' })
      .eq('id', roomId)
      .eq('status', 'waiting')
    if (updateErr) throw new Error('Failed to update room: ' + updateErr.message)

    return new Response(JSON.stringify({ ok: true, case_title: selectedCase.title }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[start-game] error:', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
