import { useEffect, useRef } from 'react'
import type { GameEvent, EventType } from '@/lib/types'
import { cn, timeAgo } from '@/lib/utils'

const EVENT_STYLE: Record<EventType, { label: string; border: string; bg: string }> = {
  statement: { label: 'إفادة',   border: 'border-gold/25',      bg: 'bg-ink-800/40' },
  question:  { label: 'سؤال',   border: 'border-blue-500/35',  bg: 'bg-blue-950/20' },
  objection: { label: 'اعتراض', border: 'border-blood/40',     bg: 'bg-blood/5' },
  system:    { label: 'نظام',   border: 'border-ink-700/30',   bg: 'bg-transparent' },
}

interface EventFeedProps {
  events:         GameEvent[]
  currentSession: number
}

export function EventFeed({ events, currentSession }: EventFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (!bottomRef.current || !containerRef.current) return
    const container = containerRef.current
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120
    if (isNearBottom) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [events.length])

  const sessionEvents = events.filter(e => e.session_num === currentSession)

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      {sessionEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8 py-12">
          <div className="text-4xl opacity-30">🗣️</div>
          <p className="text-ink-500 text-sm">لا توجد إفادات بعد في هذه الجلسة</p>
          <p className="text-ink-600 text-xs">ابدأ بكتابة إفادتك أو سؤالك أدناه</p>
        </div>
      ) : (
        <div className="space-y-2.5 p-4">
          {sessionEvents.map((event) => {
            const style = EVENT_STYLE[event.event_type]
            const isSystem = event.event_type === 'system'
            const username = event.profiles?.username ?? 'مجهول'

            if (isSystem) {
              return (
                <div key={event.id} className="flex justify-center py-1">
                  <div className="flex items-center gap-2 text-xs text-ink-500 bg-ink-800/60 px-3 py-1.5 rounded-full border border-ink-700/40">
                    <span className="w-1 h-1 rounded-full bg-gold/40 flex-shrink-0" />
                    <span>{event.content}</span>
                  </div>
                </div>
              )
            }

            return (
              <div key={event.id} className={cn(
                'rounded-xl border p-3 animate-fade-up',
                style.border, style.bg
              )}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Avatar */}
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-parch-100 flex-shrink-0"
                      style={{ background: `hsl(${username.charCodeAt(0) * 19 % 360}, 45%, 28%)` }}>
                      {username.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-parch-200 truncate">{username}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded border font-mono',
                      event.event_type === 'objection'
                        ? 'border-blood/40 text-blood-300 bg-blood/10'
                        : event.event_type === 'question'
                        ? 'border-blue-600/30 text-blue-400'
                        : 'border-gold/20 text-gold/60'
                    )}>
                      {style.label}
                    </span>
                    <span className="text-[10px] text-ink-600">{timeAgo(event.created_at)}</span>
                  </div>
                </div>
                <p className="text-sm text-parch-200 leading-relaxed pr-8">{event.content}</p>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}
