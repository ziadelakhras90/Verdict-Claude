import { supabase, callEdgeFunction } from '@/lib/supabase'
import type { VerdictValue } from '@/lib/types'

async function getUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error('يجب تسجيل الدخول أولاً')
  return user
}

export async function createRoom(opts: {
  maxPlayers?: number
  sessionDurationSeconds?: number
}) {
  const user = await getUser()

  const { data: code, error: codeErr } = await supabase.rpc('generate_room_code')
  if (codeErr) throw new Error('فشل توليد كود الغرفة: ' + codeErr.message)

  const { data: room, error: roomErr } = await supabase
    .from('game_rooms')
    .insert({
      room_code: code as string,
      host_id: user.id,
      max_players: opts.maxPlayers ?? 6,
      session_duration_seconds: opts.sessionDurationSeconds ?? 180,
    })
    .select()
    .single()

  if (roomErr) throw new Error('فشل إنشاء الغرفة: ' + roomErr.message)

  const { error: joinErr } = await supabase
    .from('room_players')
    .insert({ room_id: room.id, player_id: user.id, is_host: true, is_ready: false })

  if (joinErr) throw new Error('فشل إضافة المضيف للغرفة: ' + joinErr.message)

  return room
}

export async function joinRoom(roomCode: string) {
  const user = await getUser()

  const { data: roomData, error: fnErr } = await supabase.rpc('get_room_by_code', {
    p_code: roomCode.toUpperCase().trim(),
  })

  if (fnErr) throw new Error('خطأ في البحث عن الغرفة: ' + fnErr.message)

  const room = roomData?.[0]
  if (!room) throw new Error('الغرفة غير موجودة — تحقق من الكود')
  if (room.status !== 'waiting') throw new Error('اللعبة بدأت بالفعل في هذه الغرفة')
  if (Number(room.current_count) >= room.max_players) throw new Error('الغرفة ممتلئة')

  const { error: joinErr } = await supabase
    .from('room_players')
    .insert({ room_id: room.id, player_id: user.id, is_host: false, is_ready: false })

  if (joinErr && joinErr.code !== '23505') {
    throw new Error('فشل الانضمام: ' + joinErr.message)
  }

  return room
}

export async function setReady(roomId: string, ready: boolean) {
  const user = await getUser()

  const { error } = await supabase
    .from('room_players')
    .update({ is_ready: ready })
    .eq('room_id', roomId)
    .eq('player_id', user.id)

  if (error) throw new Error('فشل تحديث الجاهزية: ' + error.message)
}

export async function startGame(roomId: string) {
  return callEdgeFunction('start-game', { roomId })
}

export async function beginSession(roomId: string) {
  return callEdgeFunction('begin-session', { roomId })
}

export async function advanceSession(
  roomId: string,
  opts?: { target?: 'next' | 'verdict'; expectedSession?: number }
) {
  return callEdgeFunction('advance-session', {
    roomId,
    target: opts?.target ?? 'next',
    expectedSession: opts?.expectedSession,
  })
}

export async function submitEvent(
  roomId: string,
  sessionNum: number,
  content: string,
  eventType: 'statement' | 'question' | 'objection' = 'statement',
) {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('لا يمكن إرسال رسالة فارغة')
  if (trimmed.length > 500) throw new Error('الرسالة طويلة جداً')

  return callEdgeFunction('submit-event', {
    roomId,
    sessionNum,
    eventType,
    content: trimmed,
  })
}

export async function submitVerdict(roomId: string, verdict: VerdictValue) {
  return callEdgeFunction('submit-verdict', { roomId, verdict })
}

export async function revealTruth(roomId: string) {
  return callEdgeFunction<{
    ok: boolean
    actual_verdict: string
    hidden_truth: string
    results: Array<{
      player_id: string
      role: string
      did_win: boolean
      reason: string
    }>
  }>('reveal-truth', { roomId })
}

export async function fetchMyRoleCard(roomId: string) {
  const user = await getUser()

  const { data, error } = await supabase
    .from('player_role_data')
    .select('*')
    .eq('room_id', roomId)
    .eq('player_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[fetchMyRoleCard]', error.message)
  }

  return data
}

export async function fetchResults(roomId: string) {
  const { data, error } = await supabase
    .from('game_results')
    .select('*, profiles(username)')
    .eq('room_id', roomId)

  if (error) console.error('[fetchResults]', error.message)
  return data ?? []
}

export async function transferHost(roomId: string, newHostPlayerId: string) {
  const user = await getUser()

  const { error: e1 } = await supabase
    .from('room_players')
    .update({ is_host: false })
    .eq('room_id', roomId)
    .eq('player_id', user.id)

  if (e1) throw new Error('فشل تحديث المضيف: ' + e1.message)

  const { error: e2 } = await supabase
    .from('room_players')
    .update({ is_host: true })
    .eq('room_id', roomId)
    .eq('player_id', newHostPlayerId)

  if (e2) throw new Error('فشل تعيين المضيف الجديد: ' + e2.message)

  const { error: e3 } = await supabase
    .from('game_rooms')
    .update({ host_id: newHostPlayerId })
    .eq('id', roomId)

  if (e3) throw new Error('فشل تحديث الغرفة: ' + e3.message)
}

export async function leaveRoom(roomId: string) {
  const user = await getUser()

  const { error } = await supabase
    .from('room_players')
    .delete()
    .eq('room_id', roomId)
    .eq('player_id', user.id)

  if (error) throw new Error('فشل المغادرة: ' + error.message)
}

export async function playAgain(previousRoomId: string) {
  const user = await getUser()

  const { data: prev } = await supabase
    .from('game_rooms')
    .select('session_duration_seconds, max_players')
    .eq('id', previousRoomId)
    .single()

  const { data: code } = await supabase.rpc('generate_room_code')

  const { data: room, error } = await supabase
    .from('game_rooms')
    .insert({
      room_code: code as string,
      host_id: user.id,
      max_players: prev?.max_players ?? 6,
      session_duration_seconds: prev?.session_duration_seconds ?? 180,
    })
    .select()
    .single()

  if (error) throw new Error('فشل إنشاء الغرفة: ' + error.message)

  await supabase.from('room_players').insert({
    room_id: room.id,
    player_id: user.id,
    is_host: true,
    is_ready: false,
  })

  return room
}
