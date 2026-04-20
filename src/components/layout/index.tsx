import React, { useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useRoomStore } from '@/stores/roomStore'
import { Spinner } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui'
import { leaveRoom } from '@/actions'
import { useToast } from '@/hooks/useToast'

export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center">
        <Spinner size={28} />
      </div>
    )
  }
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />
  return children ? <>{children}</> : <Outlet />
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const room = useRoomStore((s) => s.room)
  const resetRoom = useRoomStore((s) => s.reset)

  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const showHomeButton = location.pathname !== '/'
  const isRoomRoute = location.pathname.startsWith('/room/')
  const exitCopy = useMemo(() => {
    if (!isRoomRoute) return 'ستعود إلى الصفحة الرئيسية.'
    if (room?.status === 'waiting') {
      return 'ستغادر الغرفة وتعود إلى الصفحة الرئيسية. إذا كنت في اللوبي فسيتم حذف عضويتك من الغرفة.'
    }
    return 'ستغادر شاشة الغرفة وتعود إلى الصفحة الرئيسية. يمكن الرجوع لاحقاً إذا كانت اللعبة ما زالت مستمرة.'
  }, [isRoomRoute, room?.status])

  async function handleGoHome() {
    if (!isRoomRoute) {
      navigate('/')
      return
    }
    setShowExitConfirm(true)
  }

  async function confirmGoHome() {
    try {
      setLeaving(true)
      if (room?.id && room.status === 'waiting') {
        await leaveRoom(room.id)
      }
      resetRoom()
      navigate('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر الخروج من الغرفة')
    } finally {
      setLeaving(false)
      setShowExitConfirm(false)
    }
  }

  return (
    <div className="min-h-screen courtroom-bg font-body text-parch-100">
      {showHomeButton && (
        <button
          type="button"
          onClick={handleGoHome}
          className="fixed top-4 left-4 z-40 rounded-xl border border-gold/20 bg-ink-900/70 px-3 py-2 text-sm text-parch-200 shadow-lg backdrop-blur transition hover:border-gold/50 hover:text-gold"
          title="العودة للرئيسية"
        >
          🏠
        </button>
      )}

      <div className="relative z-10">{children}</div>

      <Modal
        open={showExitConfirm}
        onClose={() => !leaving && setShowExitConfirm(false)}
        title="العودة إلى الرئيسية"
        size="sm"
      >
        <div className="space-y-4 text-right">
          <p className="text-sm text-parch-200 leading-relaxed">{exitCopy}</p>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setShowExitConfirm(false)} disabled={leaving}>
              إلغاء
            </Button>
            <Button variant="primary" className="flex-1" onClick={confirmGoHome} loading={leaving}>
              تأكيد
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
