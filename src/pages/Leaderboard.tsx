import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { AppShell } from '@/components/layout'
import { Button, Card, Avatar } from '@/components/ui'
import { cn } from '@/lib/utils'

interface LeaderboardRow {
  username:     string
  games_played: number
  games_won:    number
  win_rate_pct: number
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
  const navigate = useNavigate()
  const [rows, setRows]       = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('leaderboard')
      .select('*')
      .then(({ data }) => {
        if (data) setRows(data as LeaderboardRow[])
        setLoading(false)
      })
  }, [])

  return (
    <AppShell>
      <div className="min-h-screen px-4 py-10">
        <div className="max-w-md mx-auto space-y-6">

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="text-5xl">🏆</div>
            <h1 className="font-display text-3xl text-gold">قائمة المتصدرين</h1>
            <p className="text-xs text-ink-500">أفضل اللاعبين (3 مباريات كحد أدنى)</p>
          </div>

          {loading ? (
            <Card className="text-center py-10">
              <p className="text-ink-400 animate-pulse">جارٍ التحميل...</p>
            </Card>
          ) : rows.length === 0 ? (
            <Card className="text-center py-10 space-y-2">
              <p className="text-3xl">🎮</p>
              <p className="text-ink-400 text-sm">لا يوجد لاعبون بعد — كن الأول!</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div
                  key={row.username}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border transition-all',
                    'animate-fade-up',
                    i === 0 ? 'border-gold/50 bg-gold/5' :
                    i === 1 ? 'border-ink-500/30 bg-ink-800/40' :
                    i === 2 ? 'border-amber-800/30 bg-amber-900/10' :
                              'border-ink-700/30 bg-ink-800/20'
                  )}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {/* Rank */}
                  <div className="w-8 text-center flex-shrink-0">
                    {i < 3
                      ? <span className="text-xl">{MEDALS[i]}</span>
                      : <span className="text-sm text-ink-500 font-mono">#{i + 1}</span>}
                  </div>

                  {/* Avatar + name */}
                  <Avatar username={row.username} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-semibold text-parch-200 truncate">
                      {row.username}
                    </p>
                    <p className="text-xs text-ink-500">
                      {row.games_won} فوز / {row.games_played} مباراة
                    </p>
                  </div>

                  {/* Win rate */}
                  <div className="text-right flex-shrink-0">
                    <p className={cn(
                      'font-mono font-bold text-lg',
                      i === 0 ? 'text-gold' : 'text-parch-300'
                    )}>
                      {row.win_rate_pct}%
                    </p>
                    <p className="text-xs text-ink-600">معدل الفوز</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button variant="ghost" onClick={() => navigate('/')} className="w-full">
            ← العودة
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
