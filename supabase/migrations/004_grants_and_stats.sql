-- ================================================================
-- Migration 004 — View grants, profile improvements, game history
-- Run after 001, 002, 003
-- ================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Grant view access to authenticated users
--    Views in Postgres don't inherit RLS — they need explicit GRANT
-- ─────────────────────────────────────────────────────────────
GRANT SELECT ON public_case_info TO authenticated;
GRANT SELECT ON public_case_info TO anon;

-- ─────────────────────────────────────────────────────────────
-- 2. Allow all authenticated users to read other profiles (for usernames in game)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_authenticated" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────
-- 3. Allow users to update their own username
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 4. Player stats table (cumulative across all games)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_stats (
  player_id    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  games_played INT NOT NULL DEFAULT 0,
  games_won    INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_stats" ON player_stats
  FOR SELECT USING (true);

CREATE POLICY "no_client_insert_stats" ON player_stats
  FOR INSERT WITH CHECK (false);

CREATE POLICY "no_client_update_stats" ON player_stats
  FOR UPDATE USING (false);

-- ─────────────────────────────────────────────────────────────
-- 5. Auto-upsert player stats when game_results are inserted
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_player_stats()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO player_stats (player_id, games_played, games_won)
  VALUES (NEW.player_id, 1, CASE WHEN NEW.did_win THEN 1 ELSE 0 END)
  ON CONFLICT (player_id) DO UPDATE SET
    games_played = player_stats.games_played + 1,
    games_won    = player_stats.games_won + CASE WHEN NEW.did_win THEN 1 ELSE 0 END,
    updated_at   = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_game_result_insert ON game_results;
CREATE TRIGGER on_game_result_insert
  AFTER INSERT ON game_results
  FOR EACH ROW EXECUTE FUNCTION update_player_stats();

-- ─────────────────────────────────────────────────────────────
-- 6. Leaderboard view (top 20 by win rate, min 3 games)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW leaderboard AS
  SELECT
    p.username,
    ps.games_played,
    ps.games_won,
    ROUND((ps.games_won::NUMERIC / NULLIF(ps.games_played, 0)) * 100) AS win_rate_pct
  FROM player_stats ps
  JOIN profiles p ON p.id = ps.player_id
  WHERE ps.games_played >= 3
  ORDER BY win_rate_pct DESC, ps.games_won DESC
  LIMIT 20;

GRANT SELECT ON leaderboard TO authenticated;
GRANT SELECT ON leaderboard TO anon;

-- ─────────────────────────────────────────────────────────────
-- 7. Function: get_room_by_code (avoid extra round-trip)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_room_by_code(p_code TEXT)
RETURNS TABLE (
  id    UUID,
  status TEXT,
  max_players INT,
  current_count BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    gr.id,
    gr.status,
    gr.max_players,
    COUNT(rp.id)
  FROM game_rooms gr
  LEFT JOIN room_players rp ON rp.room_id = gr.id
  WHERE gr.room_code = UPPER(p_code)
  GROUP BY gr.id;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 8. Index on game_results for profile stats pages
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_game_results_player
  ON game_results(player_id, did_win);

SELECT 'Migration 004 complete' AS status;
