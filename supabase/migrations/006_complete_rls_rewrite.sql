-- ================================================================
-- Migration 006 — COMPLETE RLS REWRITE + ANONYMOUS AUTH SUPPORT
-- 
-- What this fixes:
--   1. Recursive RLS policies (room_players ↔ game_rooms loop)
--   2. profiles INSERT policy (needed for anonymous auth)
--   3. Anonymous user profile creation trigger
--   4. Atomic verdict submission (judge != host issue)
--   5. All policies rewritten using SECURITY DEFINER helpers
--
-- IDEMPOTENT — safe to re-run
-- Run AFTER migrations 001–005
-- ================================================================

-- ─────────────────────────────────────────────────────────────
-- STEP 1: Drop ALL existing policies (start clean)
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles','game_rooms','room_players',
        'player_role_data','game_events','verdicts',
        'game_results','player_stats','case_templates','case_role_cards'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- STEP 2: SECURITY DEFINER helpers (break RLS recursion)
-- ─────────────────────────────────────────────────────────────

-- Is the current user a member of the room?
CREATE OR REPLACE FUNCTION auth_is_room_member(p_room_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_players
    WHERE room_id = p_room_id AND player_id = auth.uid()
  );
$$;

-- Is the room in a specific status?
CREATE OR REPLACE FUNCTION auth_room_has_status(p_room_id UUID, p_status TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM game_rooms WHERE id = p_room_id AND status = p_status
  );
$$;

-- Is the room in any of the given statuses?
CREATE OR REPLACE FUNCTION auth_room_has_any_status(p_room_id UUID, p_statuses TEXT[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM game_rooms WHERE id = p_room_id AND status = ANY(p_statuses)
  );
$$;

-- Is the current user the judge?
CREATE OR REPLACE FUNCTION auth_is_judge_in_room(p_room_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_players
    WHERE room_id = p_room_id AND player_id = auth.uid() AND role = 'judge'
  );
$$;

-- Is the current user a member? (exposed to client via RPC)
CREATE OR REPLACE FUNCTION is_room_member(p_room_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_players
    WHERE room_id = p_room_id AND player_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- STEP 3: PROFILES
-- ─────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users (including anonymous) can read profiles
CREATE POLICY "profiles_read" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Users can create their own profile (needed for anonymous auth)
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- STEP 4: CASE TEMPLATES — blocked; use public_case_info view
-- ─────────────────────────────────────────────────────────────
ALTER TABLE case_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_role_cards  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_templates_block"  ON case_templates  FOR SELECT USING (false);
CREATE POLICY "case_role_cards_block" ON case_role_cards FOR SELECT USING (false);

-- Ensure view is accessible
GRANT SELECT ON public_case_info TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────
-- STEP 5: GAME_ROOMS — no cross-table RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_rooms_member_read" ON game_rooms
  FOR SELECT USING (auth_is_room_member(id));

CREATE POLICY "game_rooms_create" ON game_rooms
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND host_id = auth.uid());

CREATE POLICY "game_rooms_host_update" ON game_rooms
  FOR UPDATE USING (host_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- STEP 6: ROOM_PLAYERS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_players_member_read" ON room_players
  FOR SELECT USING (auth_is_room_member(room_id));

CREATE POLICY "room_players_join" ON room_players
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND player_id = auth.uid());

CREATE POLICY "room_players_update_own" ON room_players
  FOR UPDATE USING (player_id = auth.uid());

CREATE POLICY "room_players_leave" ON room_players
  FOR DELETE USING (
    player_id = auth.uid()
    AND auth_room_has_status(room_id, 'waiting')
  );

-- ─────────────────────────────────────────────────────────────
-- STEP 7: PLAYER_ROLE_DATA
-- ─────────────────────────────────────────────────────────────
ALTER TABLE player_role_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_data_own_card"  ON player_role_data FOR SELECT USING (player_id = auth.uid());
CREATE POLICY "role_data_no_insert" ON player_role_data FOR INSERT WITH CHECK (false);
CREATE POLICY "role_data_no_update" ON player_role_data FOR UPDATE USING (false);
CREATE POLICY "role_data_no_delete" ON player_role_data FOR DELETE USING (false);

-- ─────────────────────────────────────────────────────────────
-- STEP 8: GAME_EVENTS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_member_read" ON game_events
  FOR SELECT USING (auth_is_room_member(room_id));

CREATE POLICY "events_member_insert" ON game_events
  FOR INSERT WITH CHECK (
    player_id = auth.uid()
    AND auth_is_room_member(room_id)
    AND auth_room_has_any_status(room_id, ARRAY['in_session', 'verdict'])
  );

-- ─────────────────────────────────────────────────────────────
-- STEP 9: VERDICTS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE verdicts ENABLE ROW LEVEL SECURITY;

-- Judge submits verdict (via Edge Function using service role — but keep policy for safety)
CREATE POLICY "verdicts_judge_insert" ON verdicts
  FOR INSERT WITH CHECK (
    judge_id = auth.uid()
    AND auth_is_judge_in_room(room_id)
    AND auth_room_has_any_status(room_id, ARRAY['in_session', 'verdict'])
  );

CREATE POLICY "verdicts_member_read" ON verdicts
  FOR SELECT USING (auth_is_room_member(room_id));

-- ─────────────────────────────────────────────────────────────
-- STEP 10: GAME_RESULTS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "results_member_read" ON game_results
  FOR SELECT USING (
    auth_is_room_member(room_id)
    AND auth_room_has_any_status(room_id, ARRAY['reveal', 'finished'])
  );

CREATE POLICY "results_no_client_insert" ON game_results
  FOR INSERT WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────
-- STEP 11: PLAYER_STATS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stats_public_read"      ON player_stats FOR SELECT USING (true);
CREATE POLICY "stats_no_client_insert" ON player_stats FOR INSERT WITH CHECK (false);
CREATE POLICY "stats_no_client_update" ON player_stats FOR UPDATE USING (false);

-- ─────────────────────────────────────────────────────────────
-- STEP 12: Leaderboard view grants
-- ─────────────────────────────────────────────────────────────
GRANT SELECT ON leaderboard TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────
-- STEP 13: Improved handle_new_user for anonymous auth
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_username TEXT;
  v_attempts INT := 0;
BEGIN
  v_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    'guest_' || LOWER(substr(replace(NEW.id::text, '-', ''), 1, 6))
  );

  -- Handle collisions
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = v_username) AND v_attempts < 10 LOOP
    v_username := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
      'guest'
    ) || '_' || floor(random() * 9000 + 1000)::int::text;
    v_attempts := v_attempts + 1;
  END LOOP;

  INSERT INTO profiles (id, username)
  VALUES (NEW.id, v_username)
  ON CONFLICT (id) DO UPDATE
    SET username = CASE
      WHEN profiles.username LIKE 'guest_%' AND EXCLUDED.username NOT LIKE 'guest_%'
        THEN EXCLUDED.username  -- upgrade from auto-generated to user-chosen
      ELSE profiles.username
    END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block user creation due to profile errors
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- STEP 14: Atomic verdict submission DB function
-- Called by submit-verdict Edge Function (service role)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION submit_verdict_atomic(
  p_room_id  UUID,
  p_judge_id UUID,
  p_verdict  TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_room RECORD;
BEGIN
  SELECT * INTO v_room FROM game_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Room not found');
  END IF;

  IF v_room.status NOT IN ('in_session', 'verdict') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Room not in correct phase: ' || v_room.status);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM room_players
    WHERE room_id = p_room_id AND player_id = p_judge_id AND role = 'judge'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the judge can submit verdict');
  END IF;

  -- Idempotent insert
  INSERT INTO verdicts (room_id, judge_id, verdict)
  VALUES (p_room_id, p_judge_id, p_verdict)
  ON CONFLICT (room_id) DO NOTHING;

  -- Update room status
  UPDATE game_rooms SET status = 'verdict' WHERE id = p_room_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- STEP 15: generate_room_code (ensure stable)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  chars    TEXT    := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code     TEXT    := '';
  i        INT;
  attempts INT     := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM game_rooms WHERE room_code = code);
    attempts := attempts + 1;
    IF attempts > 100 THEN RAISE EXCEPTION 'Cannot generate unique code'; END IF;
  END LOOP;
  RETURN code;
END;
$$;

SELECT 'Migration 006 complete ✓' AS status;
