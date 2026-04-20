import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Spinner } from '@/components/ui'

export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  const location = useLocation()

  if (loading) return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center">
      <Spinner size={28} />
    </div>
  )
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />
  return children ? <>{children}</> : <Outlet />
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen courtroom-bg font-body text-parch-100">
      <div className="relative z-10">{children}</div>
    </div>
  )
}
