-- Tighten client event inserts. The app now uses the submit-event Edge Function,
-- so direct client inserts should only pass when the session is still active.

DROP POLICY IF EXISTS "events_member_insert" ON game_events;

CREATE POLICY "events_member_insert" ON game_events
  FOR INSERT WITH CHECK (
    player_id = auth.uid()
    AND auth_is_room_member(room_id)
    AND EXISTS (
      SELECT 1
      FROM room_players rp
      WHERE rp.room_id = game_events.room_id
        AND rp.player_id = auth.uid()
        AND COALESCE(rp.role, '') <> 'judge'
    )
    AND EXISTS (
      SELECT 1
      FROM game_rooms gr
      WHERE gr.id = game_events.room_id
        AND gr.status = 'in_session'
        AND gr.current_session = game_events.session_num
        AND gr.session_ends_at IS NOT NULL
        AND gr.session_ends_at > now()
    )
  );
