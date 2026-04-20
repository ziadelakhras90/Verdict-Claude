import { useEffect, useState } from 'react'
import { useRoomStore } from '@/stores/roomStore'

/**
 * Full-screen overlay shown when the realtime connection is lost for > 3 seconds.
 * Prompts the user to wait or reload.
 */
export function ConnectionLostOverlay() {
  const isConnected = useRoomStore(s => s.isConnected)
  const [showOverlay, setShowOverlay] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    if (!isConnected) {
      // Wait 3 s before showing — avoids flash on brief disconnects
      timer = setTimeout(() => setShowOverlay(true), 3000)
    } else {
      setShowOverlay(false)
      if (timer) clearTimeout(timer)
    }

    return () => { if (timer) clearTimeout(timer) }
  }, [isConnected])

  if (!showOverlay) return null

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-5 animate-fade-up">
        <div className="text-6xl animate-pulse">📡</div>
        <h2 className="font-display text-2xl text-gold">انقطع الاتصال</h2>
        <p className="text-ink-400 text-sm leading-relaxed">
          جارٍ محاولة إعادة الاتصال...
          <br />
          إذا استمرت المشكلة، جرّب تحديث الصفحة.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-gold text-ink-900 font-semibold rounded-lg text-sm hover:bg-gold-300 transition-colors"
          >
            تحديث الصفحة
          </button>
          <button
            onClick={() => setShowOverlay(false)}
            className="px-5 py-2.5 border border-ink-600 text-ink-400 rounded-lg text-sm hover:border-ink-500 transition-colors"
          >
            استمرار
          </button>
        </div>
      </div>
    </div>
  )
}
