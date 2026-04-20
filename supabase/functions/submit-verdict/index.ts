// supabase/functions/submit-verdict/index.ts
// Atomic verdict submission. Bypasses client RLS issue where
// the judge might not be the host (host_can_update_room would block them).
// @ts-ignore deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify caller identity
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
    const { roomId, verdict } = body

    if (!roomId) throw new Error('roomId is required')
    if (!verdict || !['guilty', 'innocent'].includes(verdict)) {
      throw new Error('verdict must be "guilty" or "innocent"')
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Call atomic DB function (handles role check + verdict insert + status update)
    const { data: result, error: fnErr } = await admin
      .rpc('submit_verdict_atomic', {
        p_room_id:  roomId,
        p_judge_id: user.id,
        p_verdict:  verdict,
      })

    if (fnErr) throw new Error('DB error: ' + fnErr.message)
    if (!result?.ok) throw new Error(result?.error ?? 'Unknown error')

    console.info(`[submit-verdict] room=${roomId} verdict=${verdict} judge=${user.id}`)

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[submit-verdict] error:', msg)
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
