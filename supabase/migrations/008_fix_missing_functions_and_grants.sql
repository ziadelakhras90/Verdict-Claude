-- ================================================================
-- Migration 008 — Create missing functions + complete all GRANTs
-- 
-- Fixes:
--   • auth_is_host_of_room was GRANTed in 007 but never created
--   • Ensures every DB helper is callable by authenticated + anon
--   • IDEMPOTENT — safe to re-run
-- ================================================================

-- Create auth_is_host_of_room (was missing)
CREATE OR REPLACE FUNCTION auth_is_host_of_room(p_room_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM game_rooms
    WHERE id = p_room_id AND host_id = auth.uid()
  );
$$;

-- ── Grant every helper function ──────────────────────────────
GRANT EXECUTE ON FUNCTION auth_is_room_member(UUID)               TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth_room_has_status(UUID, TEXT)        TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth_room_has_any_status(UUID, TEXT[])  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth_is_judge_in_room(UUID)             TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth_is_host_of_room(UUID)              TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_room_member(UUID)                    TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_room_by_code(TEXT)                  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION generate_room_code()                    TO authenticated, anon;
GRANT EXECUTE ON FUNCTION submit_verdict_atomic(UUID, UUID, TEXT) TO authenticated, anon;

-- ── View grants ──────────────────────────────────────────────
GRANT SELECT ON public_case_info TO authenticated, anon;
GRANT SELECT ON leaderboard       TO authenticated, anon;

SELECT 'Migration 008 complete ✓' AS status;
