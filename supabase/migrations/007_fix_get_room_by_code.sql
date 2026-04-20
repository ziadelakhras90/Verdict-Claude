-- ================================================================
-- Migration 007 — Fix get_room_by_code COUNT alias
-- The COUNT(rp.id) column must be explicitly aliased as 'current_count'
-- to match what the frontend expects.
-- Also fix the function to use SECURITY DEFINER so it bypasses RLS
-- when called by anonymous users.
-- ================================================================

CREATE OR REPLACE FUNCTION get_room_by_code(p_code TEXT)
RETURNS TABLE (
  id            UUID,
  status        TEXT,
  max_players   INT,
  current_count BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    gr.id,
    gr.status,
    gr.max_players,
    COUNT(rp.id) AS current_count
  FROM game_rooms gr
  LEFT JOIN room_players rp ON rp.room_id = gr.id
  WHERE gr.room_code = UPPER(p_code)
  GROUP BY gr.id;
END;
$$;

-- Also fix generate_room_code to be SECURITY DEFINER
-- (anonymous users need to call it when creating rooms)
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars    TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code     TEXT := '';
  i        INT;
  attempts INT  := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM game_rooms WHERE room_code = code);
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Cannot generate unique room code after 100 attempts';
    END IF;
  END LOOP;
  RETURN code;
END;
$$;

-- Grant execute to anonymous users (they need to call these)
GRANT EXECUTE ON FUNCTION get_room_by_code(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_room_by_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_room_code() TO anon;
GRANT EXECUTE ON FUNCTION generate_room_code() TO authenticated;

-- Also grant execute to the auth helper functions
GRANT EXECUTE ON FUNCTION auth_is_room_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_is_room_member(UUID) TO anon;
GRANT EXECUTE ON FUNCTION auth_room_has_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_room_has_any_status(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_is_judge_in_room(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_is_host_of_room(UUID) TO authenticated;

SELECT 'Migration 007 complete' AS status;
