import { useState } from 'react'
import { cn } from '@/lib/utils'

interface InviteToastProps {
  roomCode: string
  onDismiss: () => void
}

export function InviteToast({ roomCode, onDismiss }: InviteToastProps) {
  const [copied, setCopied] = useState(false)

  function copy(type: 'code' | 'link') {
    const text = type === 'code'
      ? roomCode
      : `${window.location.origin}/join/${roomCode}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed bottom-6 inset-x-4 max-w-sm mx-auto z-40 animate-fade-up">
      <div className="bg-ink-700 border border-gold/30 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-body font-semibold text-parch-200 mb-1">
              شارك الغرفة مع أصدقائك
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => copy('code')}
                className={cn(
                  'flex-1 py-2 text-xs font-mono font-bold rounded-lg border transition-all',
                  copied ? 'border-green-600/50 bg-green-900/20 text-green-300' : 'border-gold/40 bg-gold/10 text-gold'
                )}
              >
                {copied ? '✓ تم النسخ' : roomCode}
              </button>
              <button
                onClick={() => copy('link')}
                className="px-3 py-2 text-xs text-ink-400 border border-ink-600 rounded-lg hover:border-ink-500 transition-colors"
              >
                🔗 رابط
              </button>
            </div>
          </div>
          <button onClick={onDismiss} className="text-ink-500 hover:text-ink-300 text-lg leading-none mt-0.5">×</button>
        </div>
      </div>
    </div>
  )
}
