-- ================================================================
-- Migration 005 — Event policy fix, room cleanup, presence support
-- ================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Fix game_events INSERT policy
--    Old: only allows 'in_session' status
--    New: also allows 'verdict' phase (judge may add closing remarks)
--    System events (player_id = null) are only inserted via service role
--    which bypasses RLS entirely — no change needed there.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "member_can_insert_event" ON game_events;

CREATE POLICY "member_can_insert_event" ON game_events
  FOR INSERT WITH CHECK (
    player_id = auth.uid()
    AND room_id IN (
      SELECT rp.room_id FROM room_players rp
      JOIN game_rooms gr ON gr.id = rp.room_id
      WHERE rp.player_id = auth.uid()
        AND gr.status IN ('in_session', 'verdict')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. Allow players to DELETE themselves from room_players
--    (leave room during lobby phase)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "player_can_leave" ON room_players;

CREATE POLICY "player_can_leave" ON room_players
  FOR DELETE USING (
    player_id = auth.uid()
    AND room_id IN (
      SELECT id FROM game_rooms
      WHERE id = room_players.room_id
        AND status = 'waiting'      -- can only leave in lobby
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. Auto-cleanup: mark room as 'finished' if all players leave
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_empty_room()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- If no players remain in a non-finished room, finish it
  IF NOT EXISTS (
    SELECT 1 FROM room_players WHERE room_id = OLD.room_id
  ) THEN
    UPDATE game_rooms
    SET status = 'finished'
    WHERE id = OLD.room_id
      AND status NOT IN ('finished');
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_player_leave ON room_players;
CREATE TRIGGER on_player_leave
  AFTER DELETE ON room_players
  FOR EACH ROW EXECUTE FUNCTION cleanup_empty_room();

-- ─────────────────────────────────────────────────────────────
-- 4. Add 'is_connected' column to room_players for presence
-- ─────────────────────────────────────────────────────────────
ALTER TABLE room_players ADD COLUMN IF NOT EXISTS
  last_seen_at TIMESTAMPTZ DEFAULT now();

-- ─────────────────────────────────────────────────────────────
-- 5. Host transfer: allow host to update another player's is_host
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "player_can_update_own" ON room_players;

CREATE POLICY "player_can_update_own_or_host_transfer" ON room_players
  FOR UPDATE USING (
    -- Player updates their own row
    player_id = auth.uid()
    OR
    -- Host transfers host status to another player in same room
    room_id IN (
      SELECT room_id FROM room_players
      WHERE player_id = auth.uid() AND is_host = true
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 6. Index for faster presence heartbeat queries
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_room_players_last_seen
  ON room_players(room_id, last_seen_at);

-- ─────────────────────────────────────────────────────────────
-- 7. Function: check if a user is a member of a room (used by frontend guard)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_room_member(p_room_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM room_players
    WHERE room_id = p_room_id AND player_id = auth.uid()
  );
END;
$$;

SELECT 'Migration 005 complete' AS status;
