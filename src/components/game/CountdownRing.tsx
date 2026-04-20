import { useSessionTimer } from '@/hooks/useSessionTimer'
import { useRoomStore } from '@/stores/roomStore'

interface CountdownRingProps {
  totalSeconds: number
  size?: number
}

export function CountdownRing({ totalSeconds, size = 120 }: CountdownRingProps) {
  const { secondsLeft, isUrgent, isExpired } = useSessionTimer()
  const session = useRoomStore(s => s.room?.current_session ?? 1)

  const radius       = (size - 14) / 2
  const circumference = 2 * Math.PI * radius
  const progress     = totalSeconds > 0 ? secondsLeft / totalSeconds : 0
  const dashOffset   = circumference * (1 - progress)
  const minutes      = Math.floor(secondsLeft / 60)
  const secs         = secondsLeft % 60
  const cx = size / 2
  const cy = size / 2

  // SVG elements don't support Tailwind — use explicit color values
  const ringColor  = isExpired ? '#352E28' : isUrgent ? '#8B1A1A' : '#C9A84C'
  const textColor  = isExpired ? '#4D453C' : isUrgent ? '#D94444' : '#C9A84C'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="timer" aria-label={`${minutes}:${String(secs).padStart(2,'0')}`}>
      {/* Track ring */}
      <circle cx={cx} cy={cy} r={radius}
        fill="none" stroke="rgba(201,168,76,0.1)" strokeWidth={7} />

      {/* Progress ring */}
      <circle cx={cx} cy={cy} r={radius}
        fill="none"
        stroke={ringColor}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s ease' }}
      />

      {/* Time display */}
      <text x={cx} y={cy - 4}
        textAnchor="middle" dominantBaseline="middle"
        fill={textColor}
        fontSize={size * 0.21}
        fontFamily="'IBM Plex Mono', monospace"
        fontWeight="700"
        style={{ transition: 'fill 0.4s' }}
      >
        {`${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`}
      </text>

      {/* Session label */}
      <text x={cx} y={cy + size * 0.17}
        textAnchor="middle"
        fill="rgba(201,168,76,0.4)"
        fontSize={size * 0.1}
        fontFamily="'IBM Plex Sans Arabic', sans-serif"
      >
        {`جلسة ${session}/3`}
      </text>
    </svg>
  )
}
