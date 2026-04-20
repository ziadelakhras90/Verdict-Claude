// supabase/functions/reveal-truth/index.ts
// @ts-ignore deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type VerdictValue = 'guilty' | 'innocent'
type Role = 'defendant' | 'defense_attorney' | 'prosecutor' | 'judge' | 'deputy' | 'witness'

function computeWin(
  role: Role,
  finalVerdict: VerdictValue,
  actualVerdict: VerdictValue
): { did_win: boolean; reason: string } {
  const match = finalVerdict === actualVerdict
  switch (role) {
    case 'defendant':
      return {
        did_win: finalVerdict === 'innocent',
        reason: finalVerdict === 'innocent' ? 'صدر الحكم ببراءته' : 'صدر الحكم بإدانته',
      }
    case 'defense_attorney':
      return {
        did_win: finalVerdict === 'innocent',
        reason: finalVerdict === 'innocent' ? 'نجح في إثبات البراءة' : 'فشل في الدفاع عن موكله',
      }
    case 'prosecutor':
      return {
        did_win: finalVerdict === 'guilty',
        reason: finalVerdict === 'guilty' ? 'نجح في إثبات الإدانة' : 'فشل في إثبات التهمة',
      }
    case 'judge':
      return {
        did_win: match,
        reason: match ? 'حكمه طابق الحقيقة الفعلية' : 'حكمه لم يطابق الحقيقة',
      }
    case 'deputy':
      return {
        did_win: match,
        reason: match ? 'ساهم في إيصال القضية للحقيقة' : 'لم تسفر جهوده عن النتيجة الصحيحة',
      }
    case 'witness':
      return {
        did_win: match,
        reason: match ? 'شهادته أسهمت في الوصول للحقيقة' : 'شهادته لم تُفضِ للنتيجة الصحيحة',
      }
    default:
      return { did_win: false, reason: 'دور غير معروف' }
  }
}

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

    // Verify caller is host or judge
    const { data: callerPlayer } = await admin
      .from('room_players')
      .select('role, is_host')
      .eq('room_id', roomId)
      .eq('player_id', user.id)
      .single()

    if (!callerPlayer) throw new Error('You are not in this room')
    const canReveal = callerPlayer.is_host || callerPlayer.role === 'judge'
    if (!canReveal) throw new Error('Only host or judge can reveal truth')

    // Fetch room + case
    const { data: room, error: roomErr } = await admin
      .from('game_rooms')
      .select('*, case_templates(actual_verdict, hidden_truth, title)')
      .eq('id', roomId)
      .single()

    if (roomErr || !room) throw new Error('Room not found')
    if (!['verdict', 'reveal', 'finished'].includes(room.status)) {
      throw new Error('Room not in verdict/reveal phase (status: ' + room.status + ')')
    }

    const ct = room.case_templates as {
      actual_verdict: string
      hidden_truth: string
      title: string
    }

    if (!ct) throw new Error('No case assigned to this room')

    // Idempotent: if already revealed, return existing results
    if (room.status === 'reveal' || room.status === 'finished') {
      const { data: existingResults } = await admin
        .from('game_results')
        .select('*, profiles(username)')
        .eq('room_id', roomId)

      return new Response(
        JSON.stringify({
          ok: true,
          actual_verdict: ct.actual_verdict,
          hidden_truth:   ct.hidden_truth,
          results: existingResults ?? [],
          idempotent: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch verdict
    const { data: verdictRow, error: verdictErr } = await admin
      .from('verdicts')
      .select('verdict')
      .eq('room_id', roomId)
      .single()

    if (verdictErr || !verdictRow) {
      throw new Error('No verdict submitted yet. Judge must submit verdict first.')
    }

    const actualVerdict = ct.actual_verdict as VerdictValue
    const finalVerdict  = verdictRow.verdict as VerdictValue

    // Fetch all players with roles
    const { data: players, error: playersErr } = await admin
      .from('room_players')
      .select('player_id, role')
      .eq('room_id', roomId)

    if (playersErr || !players?.length) {
      throw new Error('Failed to fetch players')
    }

    // Compute win/lose for each player
    const results = players
      .filter(p => p.role)
      .map(p => {
        const { did_win, reason } = computeWin(
          p.role as Role, finalVerdict, actualVerdict
        )
        return {
          room_id:   roomId,
          player_id: p.player_id,
          role:      p.role,
          did_win,
          reason,
        }
      })

    // Upsert results
    const { error: insertErr } = await admin
      .from('game_results')
      .upsert(results, { onConflict: 'room_id,player_id' })

    if (insertErr) throw new Error('Failed to save results: ' + insertErr.message)

    // System event
    await admin.from('game_events').insert({
      room_id:     roomId,
      player_id:   null,
      event_type:  'system',
      session_num: 3,
      content: `الحقيقة: المتهم ${actualVerdict === 'guilty' ? 'مذنب' : 'بريء'} فعلاً — ` +
               `حكم القاضي كان ${finalVerdict === actualVerdict ? 'صحيحاً ✓' : 'خاطئاً ✗'}`,
    })

    // Mark room as reveal
    await admin
      .from('game_rooms')
      .update({ status: 'reveal' })
      .eq('id', roomId)

    console.info(`[reveal-truth] room=${roomId} actual=${actualVerdict} judge_verdict=${finalVerdict}`)

    return new Response(
      JSON.stringify({
        ok: true,
        actual_verdict: actualVerdict,
        hidden_truth:   ct.hidden_truth,
        results: results.map(r => ({
          player_id: r.player_id,
          role:      r.role,
          did_win:   r.did_win,
          reason:    r.reason,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[reveal-truth] error:', msg)
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
