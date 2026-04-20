import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button, Avatar } from '@/components/ui'
import { transferHost } from '@/actions'
import { useToast } from '@/hooks/useToast'
import type { RoomPlayer } from '@/lib/types'

interface HostTransferModalProps {
  open:         boolean
  onClose:      () => void
  roomId:       string
  players:      RoomPlayer[]
  currentUserId: string | null
}

export function HostTransferModal({
  open, onClose, roomId, players, currentUserId
}: HostTransferModalProps) {
  const toast       = useToast()
  const [loading, setLoading] = useState<string | null>(null)

  const eligible = players.filter(
    p => p.player_id !== currentUserId && !p.is_host
  )

  async function handleTransfer(newHostId: string) {
    setLoading(newHostId)
    try {
      await transferHost(roomId, newHostId)
      toast.success('تم نقل صلاحية المضيف')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل نقل الصلاحية')
    } finally {
      setLoading(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="نقل صلاحية المضيف" size="sm">
      <div className="space-y-3">
        <p className="text-sm text-ink-400">
          اختر من سيتولى إدارة الغرفة
        </p>
        {eligible.length === 0 ? (
          <p className="text-sm text-ink-500 text-center py-4">
            لا يوجد لاعبون آخرون
          </p>
        ) : (
          eligible.map(p => {
            const username = p.profiles?.username ?? 'لاعب'
            return (
              <div key={p.player_id} className="flex items-center gap-3 p-3 rounded-xl border border-ink-700/40 bg-ink-800/40">
                <Avatar username={username} size={36} />
                <span className="flex-1 text-sm text-parch-200">{username}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={loading === p.player_id}
                  onClick={() => handleTransfer(p.player_id)}
                >
                  اختر
                </Button>
              </div>
            )
          })
        )}
      </div>
    </Modal>
  )
}
