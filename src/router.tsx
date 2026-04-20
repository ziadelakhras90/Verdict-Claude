import { createBrowserRouter, Outlet, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useRoomStore } from '@/stores/roomStore'
import { Spinner } from '@/components/ui'
import { AppShell } from '@/components/layout'
import type { Profile } from '@/lib/types'

// Lazy-load every page
const Home          = lazy(() => import('@/pages/Home'))
const Auth          = lazy(() => import('@/pages/Auth'))
const ProfileSetup  = lazy(() => import('@/pages/ProfileSetup'))
const ProfilePage   = lazy(() => import('@/pages/Profile'))
const CreateRoom    = lazy(() => import('@/pages/CreateRoom'))
const JoinRoom      = lazy(() => import('@/pages/JoinRoom'))
const Lobby         = lazy(() => import('@/pages/Lobby'))
const RoleCard      = lazy(() => import('@/pages/RoleCard'))
const Session       = lazy(() => import('@/pages/Session'))
const JudgePanel    = lazy(() => import('@/pages/JudgePanel'))
const Verdict       = lazy(() => import('@/pages/Verdict'))
const Reveal        = lazy(() => import('@/pages/Reveal'))
const Results       = lazy(() => import('@/pages/Results'))
const Leaderboard   = lazy(() => import('@/pages/Leaderboard'))
const Admin         = lazy(() => import('@/pages/Admin'))
const NotFound      = lazy(() => import('@/pages/NotFound'))

function PageFallback() {
  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center">
      <Spinner size={28} />
    </div>
  )
}
function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

// ─── Shared profile fetch/create helper ──────────────────────
async function resolveProfile(userId: string, metaUsername?: string): Promise<Profile | null> {
  const trimmedMeta = metaUsername?.trim()
  const hasChosenName = !!trimmedMeta && !trimmedMeta.startsWith('guest_')

  // 1. Try existing profile first.
  const { data: existing } = await supabase
    .from('profiles').select('*').eq('id', userId).single()

  // Upgrade auto-generated guest usernames to the chosen auth metadata username.
  if (existing) {
    const existingProfile = existing as Profile
    if (hasChosenName && existingProfile.username.startsWith('guest_')) {
      const { data: upgraded } = await supabase
        .from('profiles')
        .update({ username: trimmedMeta })
        .eq('id', userId)
        .select()
        .single()
      return (upgraded as Profile) ?? existingProfile
    }
    return existingProfile
  }

  // 2. Create it (trigger might be delayed or failed)
  const username = trimmedMeta || ('guest_' + userId.slice(0, 6))
  const { data: created } = await supabase
    .from('profiles')
    .upsert({ id: userId, username }, { onConflict: 'id' })
    .select().single()
  return (created as Profile) ?? null
}

// ─── Single AuthProvider — the ONLY place we subscribe to auth ─
function AuthProvider() {
  const { setUser, setProfile, setLoading } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Bootstrap: restore existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        const metaUsername = session.user.user_metadata?.username
        const profile = await resolveProfile(session.user.id, metaUsername)
        setProfile(profile)
      }
      setLoading(false)
      setReady(true)
    })

    // React to all auth events (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          const metaUsername = session.user.user_metadata?.username
          const profile = await resolveProfile(session.user.id, metaUsername)
          setProfile(profile)
        } else {
          setProfile(null)
          // Clear room state on logout
          useRoomStore.getState().reset()
        }
        setLoading(false)
        // Make sure ready is set (in case this fires before getSession resolves)
        if (!ready) setReady(true)
      }
    )

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!ready) return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="text-5xl animate-flicker">⚖️</div>
          <Spinner size={24} />
        </div>
      </div>
    </AppShell>
  )

  return <Outlet />
}

// ─── Route guards ─────────────────────────────────────────────
function RequireAuthOnly() {
  const { user, loading } = useAuthStore()
  if (loading) return <PageFallback />
  if (!user)   return <Navigate to="/auth" replace />
  return <Outlet />
}

function RequireAuth() {
  const { user, profile, loading } = useAuthStore()
  if (loading) return <PageFallback />
  if (!user)                return <Navigate to="/auth"  replace />
  if (!profile?.username)   return <Navigate to="/setup" replace />
  return <Outlet />
}

// ─── Router definition ────────────────────────────────────────
export const router = createBrowserRouter([
  {
    element: <AuthProvider />,
    children: [
      { path: '/',            element: <Lazy><Home /></Lazy> },
      { path: '/auth',        element: <Lazy><Auth /></Lazy> },
      { path: '/leaderboard', element: <Lazy><Leaderboard /></Lazy> },

      { element: <RequireAuthOnly />, children: [
        { path: '/setup', element: <Lazy><ProfileSetup /></Lazy> },
      ]},

      { element: <RequireAuth />, children: [
        { path: '/profile',    element: <Lazy><ProfilePage /></Lazy> },
        { path: '/create',     element: <Lazy><CreateRoom /></Lazy> },
        { path: '/join',       element: <Lazy><JoinRoom /></Lazy> },
        { path: '/join/:code', element: <Lazy><JoinRoom /></Lazy> },
        { path: '/admin',      element: <Lazy><Admin /></Lazy> },
        {
          path: '/room/:id',
          children: [
            { index: true,     element: <Navigate to="lobby" replace /> },
            { path: 'lobby',   element: <Lazy><Lobby /></Lazy> },
            { path: 'card',    element: <Lazy><RoleCard /></Lazy> },
            { path: 'session', element: <Lazy><Session /></Lazy> },
            { path: 'judge',   element: <Lazy><JudgePanel /></Lazy> },
            { path: 'verdict', element: <Lazy><Verdict /></Lazy> },
            { path: 'reveal',  element: <Lazy><Reveal /></Lazy> },
            { path: 'results', element: <Lazy><Results /></Lazy> },
          ],
        },
      ]},

      { path: '/404', element: <Lazy><NotFound /></Lazy> },
      { path: '*',    element: <Navigate to="/" replace /> },
    ],
  },
])
