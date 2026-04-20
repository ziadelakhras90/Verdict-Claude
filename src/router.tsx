import { createBrowserRouter, Outlet, Navigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Spinner } from '@/components/ui'
import { AppShell } from '@/components/layout'

import Home       from '@/pages/Home'
import Auth       from '@/pages/Auth'
import CreateRoom from '@/pages/CreateRoom'
import JoinRoom   from '@/pages/JoinRoom'
import Lobby      from '@/pages/Lobby'
import RoleCard   from '@/pages/RoleCard'
import Session    from '@/pages/Session'
import JudgePanel from '@/pages/JudgePanel'
import Verdict    from '@/pages/Verdict'
import Reveal     from '@/pages/Reveal'
import Results    from '@/pages/Results'
import NotFound   from '@/pages/NotFound'

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

function AuthProvider() {
  const { setUser, setProfile, setLoading } = useAuthStore()
  const [ready, setReady] = useState(false)
  const didInit = useRef(false)

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true

    let mounted = true

    const syncProfile = async (userId: string) => {
      try {
        const profile = await fetchProfile(userId)
        if (!mounted) return
        setProfile(profile)
      } catch {
        if (!mounted) return
        setProfile(null)
      }
    }

    const boot = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return

        setUser(session?.user ?? null)

        if (session?.user) {
          await syncProfile(session.user.id)
        } else {
          setProfile(null)
        }
      } catch {
        if (!mounted) return
        setUser(null)
        setProfile(null)
      } finally {
        if (!mounted) return
        setLoading(false)
        setReady(true)
      }
    }

    void boot()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return

      setUser(session?.user ?? null)

      if (!session?.user) {
        setProfile(null)
        setLoading(false)
        setReady(true)
        return
      }

      queueMicrotask(() => {
        void syncProfile(session.user.id).finally(() => {
          if (!mounted) return
          setLoading(false)
          setReady(true)
        })
      })
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [setLoading, setProfile, setUser])

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

function RequireAuth() {
  const { user, loading } = useAuthStore()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-ink-900">
      <Spinner size={28} />
    </div>
  )
  if (!user) return <Navigate to="/auth" replace />
  return <Outlet />
}

export const router = createBrowserRouter([
  {
    element: <AuthProvider />,
    children: [
      { path: '/',     element: <Home /> },
      { path: '/auth', element: <Auth /> },

      {
        element: <RequireAuth />,
        children: [
          { path: '/create',     element: <CreateRoom /> },
          { path: '/join',       element: <JoinRoom /> },
          { path: '/join/:code', element: <JoinRoom /> },

          {
            path: '/room/:id',
            children: [
              { index: true,     element: <Navigate to="lobby" replace /> },
              { path: 'lobby',   element: <Lobby /> },
              { path: 'card',    element: <RoleCard /> },
              { path: 'session', element: <Session /> },
              { path: 'judge',   element: <JudgePanel /> },
              { path: 'verdict', element: <Verdict /> },
              { path: 'reveal',  element: <Reveal /> },
              { path: 'results', element: <Results /> },
            ],
          },
        ],
      },

      { path: '/404', element: <NotFound /> },
      { path: '*',    element: <Navigate to="/" replace /> },
    ],
  },
])
