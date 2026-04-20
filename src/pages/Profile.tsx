import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout'
import { Button, Card, Avatar } from '@/components/ui'
import { cn } from '@/lib/utils'

interface Stats { games_played: number; games_won: number }

export default function ProfilePage() {
  const navigate   = useNavigate()
  const { user, profile } = useAuthStore()
  const setProfile = useAuthStore(s => s.setProfile)
  const { signOut } = useAuth()

  const [stats, setStats]       = useState<Stats | null>(null)
  const [editing, setEditing]   = useState(false)
  const [username, setUsername] = useState(profile?.username ?? '')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!user) { navigate('/auth', { replace: true }); return }
    supabase
      .from('player_stats')
      .select('games_played, games_won')
      .eq('player_id', user.id)
      .single()
      .then(({ data }) => { if (data) setStats(data) })
  }, [user])

  async function handleSaveUsername(e: React.FormEvent) {
    e.preventDefault()
    const name = username.trim()
    if (!name || !user) return
    if (name.length < 2)  { setError('الاسم قصير جداً'); return }
    if (name.length > 20) { setError('الاسم طويل جداً'); return }
    setSaving(true)
    setError('')
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .update({ username: name })
        .eq('id', user.id)
        .select()
        .single()
      if (err) {
        if (err.code === '23505') throw new Error('هذا الاسم مأخوذ — جرب اسماً آخر')
        throw err
      }
      setProfile(data)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const winRate = stats && stats.games_played > 0
    ? Math.round((stats.games_won / stats.games_played) * 100)
    : 0

  return (
    <AppShell>
      <div className="min-h-screen px-4 py-10">
        <div className="max-w-sm mx-auto space-y-6">

          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-ink-500 hover:text-parch-200 transition-colors text-xl leading-none">←</button>
            <h1 className="font-display text-2xl text-gold">حسابي</h1>
          </div>

          <Card className="flex flex-col items-center gap-4 py-6">
            <Avatar username={profile?.username ?? '?'} size={72} />
            {editing ? (
              <form onSubmit={handleSaveUsername} className="w-full space-y-3 px-2">
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  maxLength={20}
                  autoFocus
                  dir="rtl"
                  className="w-full bg-ink-900 border border-gold/40 text-parch-100 px-4 py-2.5 rounded-xl font-body text-center focus:outline-none focus:border-gold"
                />
                {error && <p className="text-xs text-blood-300 text-center">{error}</p>}
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" loading={saving} size="sm" className="flex-1">حفظ</Button>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => { setEditing(false); setUsername(profile?.username ?? ''); setError('') }}
                    className="flex-1">إلغاء</Button>
                </div>
              </form>
            ) : (
              <>
                <div className="text-center">
                  <p className="font-body font-bold text-xl text-parch-100">{profile?.username}</p>
                  {/* Anonymous users have no email — show guest label instead */}
                  <p className="text-xs text-ink-500 mt-0.5">
                    {user?.email ?? 'ضيف مجهول'}
                  </p>
                </div>
                <Button variant="ghost" size="sm"
                  onClick={() => { setEditing(true); setUsername(profile?.username ?? '') }}>
                  ✏️ تغيير الاسم
                </Button>
              </>
            )}
          </Card>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'مباريات', value: stats?.games_played ?? '—' },
              { label: 'فوز',     value: stats?.games_won    ?? '—' },
              { label: 'معدل',    value: stats ? `${winRate}%` : '—' },
            ].map(s => (
              <Card key={s.label} className="text-center py-4">
                <p className={cn('font-mono font-bold text-2xl', typeof s.value === 'string' && s.value.includes('%') && winRate >= 50 ? 'text-gold' : 'text-parch-200')}>
                  {s.value}
                </p>
                <p className="label-sm mt-1">{s.label}</p>
              </Card>
            ))}
          </div>

          <div className="space-y-2">
            <Button variant="ghost" className="w-full" onClick={() => navigate('/leaderboard')}>🏆 قائمة المتصدرين</Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate('/create')}>🎮 إنشاء لعبة</Button>
            <Button variant="danger" className="w-full" onClick={async () => { await signOut(); navigate('/') }}>
              تسجيل الخروج
            </Button>
          </div>

        </div>
      </div>
    </AppShell>
  )
}
