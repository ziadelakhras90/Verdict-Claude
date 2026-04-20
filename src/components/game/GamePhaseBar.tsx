import { useRoomStore } from '@/stores/roomStore'
import type { RoomStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const PHASES: { status: RoomStatus; label: string; icon: string }[] = [
  { status: 'waiting',    label: 'اللوبي',   icon: '🚪' },
  { status: 'starting',   label: 'البطاقات', icon: '🃏' },
  { status: 'in_session', label: 'الجلسات',  icon: '🗣️' },
  { status: 'verdict',    label: 'الحكم',    icon: '🔨' },
  { status: 'reveal',     label: 'الكشف',    icon: '🔍' },
  { status: 'finished',   label: 'النتائج',  icon: '🏆' },
]

const PHASE_ORDER: Record<RoomStatus, number> = {
  waiting: 0, starting: 1, in_session: 2,
  verdict: 3, reveal: 4, finished: 5,
}

export function GamePhaseBar() {
  const status   = useRoomStore(s => s.room?.status)
  const caseInfo = useRoomStore(s => s.caseInfo)

  if (!status) return null

  const currentIndex = PHASE_ORDER[status] ?? 0

  return (
    <div className="px-4 py-2 border-b border-ink-800/60 bg-ink-900/60">
      {caseInfo && (
        <p className="text-center text-xs text-gold/60 font-body mb-2 truncate">
          ⚖️ {caseInfo.title}
        </p>
      )}
      <div className="flex items-center justify-between gap-1">
        {PHASES.map((phase, i) => {
          const isDone    = i < currentIndex
          const isCurrent = i === currentIndex
          const isFuture  = i > currentIndex

          return (
            <div key={phase.status} className="flex items-center flex-1">
              <div className={cn(
                'flex flex-col items-center gap-0.5 flex-1 transition-all duration-300',
                isCurrent ? 'opacity-100' : 'opacity-40'
              )}>
                <span className={cn('text-base transition-transform', isCurrent && 'scale-110')}>
                  {phase.icon}
                </span>
                <span className={cn(
                  'text-[9px] font-body text-center leading-none transition-colors',
                  isCurrent ? 'text-gold' : isDone ? 'text-green-400/70' : 'text-ink-600'
                )}>
                  {phase.label}
                </span>
              </div>

              {/* Connector line between phases */}
              {i < PHASES.length - 1 && (
                <div className={cn(
                  'h-px flex-1 max-w-4 mx-0.5 rounded transition-colors duration-500',
                  i < currentIndex ? 'bg-green-600/60' : 'bg-ink-700'
                )} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
