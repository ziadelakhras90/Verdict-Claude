import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { AppShell } from '@/components/layout'
import { Button, Card, Badge } from '@/components/ui'
import { CATEGORY_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

interface CaseRow {
  id: string; title: string; category: string
  difficulty: number; min_players: number; max_players: number
}

interface RoomRow {
  id: string; room_code: string; status: string
  max_players: number; created_at: string; player_count?: number
}

const DIFF_STARS = ['', '★', '★★', '★★★']
const STATUS_COLOR: Record<string, 'gold' | 'green' | 'purple' | 'gray'> = {
  waiting: 'gray', starting: 'gold', in_session: 'green',
  verdict: 'purple', reveal: 'purple', finished: 'gray',
}

export default function Admin() {
  const navigate = useNavigate()
  const [cases, setCases]   = useState<CaseRow[]>([])
  const [rooms, setRooms]   = useState<RoomRow[]>([])
  const [tab, setTab]       = useState<'cases' | 'rooms'>('cases')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Use public_case_info view (what authenticated users can see)
      const { data: caseData } = await supabase
        .from('public_case_info')
        .select('id, title, category, difficulty, min_players, max_players')
        .order('title')

      if (caseData) setCases(caseData)

      const { data: roomData } = await supabase
        .from('game_rooms')
        .select('id, room_code, status, max_players, created_at')
        .neq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(20)

      if (roomData) {
        const withCount = await Promise.all(
          roomData.map(async r => {
            const { count } = await supabase
              .from('room_players')
              .select('*', { count: 'exact', head: true })
              .eq('room_id', r.id)
            return { ...r, player_count: count ?? 0 }
          })
        )
        setRooms(withCount)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="min-h-screen p-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">

          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl text-gold">لوحة الإدارة</h1>
              <p className="text-xs text-ink-500 mt-0.5">إدارة القضايا والغرف</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>← الرئيسية</Button>
          </div>

          <div className="flex gap-2">
            {(['cases', 'rooms'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-body border transition-all',
                  tab === t ? 'border-gold/50 bg-gold/10 text-gold' : 'border-ink-700/50 text-ink-400 hover:border-ink-600'
                )}>
                {t === 'cases' ? `📋 القضايا (${cases.length})` : `🚪 الغرف النشطة (${rooms.length})`}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-10 text-ink-400 animate-pulse">جارٍ التحميل...</div>
          ) : tab === 'cases' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="label-sm">القضايا المتاحة</p>
                <Button variant="ghost" size="sm" onClick={loadData}>↻</Button>
              </div>

              {cases.length === 0 ? (
                <Card className="text-center py-10">
                  <p className="text-ink-500 text-sm">لا توجد قضايا — نفِّذ ملفات الـ migrations أولاً</p>
                </Card>
              ) : cases.map(c => (
                <Card key={c.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-body font-semibold text-parch-100 truncate">{c.title}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge label={CATEGORY_LABELS[c.category] ?? c.category} color="gold" />
                        <span className="text-xs text-ink-500">{c.min_players}–{c.max_players} لاعبين</span>
                        <span className="text-gold/50 text-xs">{DIFF_STARS[c.difficulty ?? 1]}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-ink-600 font-mono">ID: {c.id.slice(0, 8)}...</p>
                </Card>
              ))}

              <Card className="border-dashed border-ink-700 space-y-2">
                <p className="label-sm">إضافة قضية جديدة</p>
                <ol className="text-xs text-ink-400 space-y-1 list-decimal list-inside">
                  <li>افتح Supabase Dashboard → Table Editor</li>
                  <li>أضف صفاً في <code className="text-gold">case_templates</code></li>
                  <li>أضف بطاقات الأدوار في <code className="text-gold">case_role_cards</code></li>
                  <li>تأكد من <code className="text-gold">is_active = true</code></li>
                </ol>
              </Card>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="label-sm">الغرف النشطة</p>
                <Button variant="ghost" size="sm" onClick={loadData}>↻ تحديث</Button>
              </div>

              {rooms.length === 0 ? (
                <Card className="text-center py-10">
                  <p className="text-ink-500 text-sm">لا توجد غرف نشطة حالياً</p>
                </Card>
              ) : rooms.map(r => (
                <Card key={r.id} className="flex items-center gap-4">
                  <div className="font-mono text-2xl font-bold text-gold/80 w-20 text-center flex-shrink-0">
                    {r.room_code}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge label={r.status} color={STATUS_COLOR[r.status] ?? 'gray'} />
                      <span className="text-xs text-ink-500">{r.player_count}/{r.max_players} لاعبين</span>
                    </div>
                    <p className="text-xs text-ink-600 mt-0.5 font-mono">
                      {new Date(r.created_at).toLocaleTimeString('ar-SA')}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/room/${r.id}/lobby`)}>دخول</Button>
                </Card>
              ))}
            </div>
          )}

        </div>
      </div>
    </AppShell>
  )
}
