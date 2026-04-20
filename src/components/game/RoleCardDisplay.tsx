import { useState } from 'react'
import type { PublicCaseInfo, RoleCard } from '@/lib/types'
import { ROLE_LABELS, ROLE_EMOJI } from '@/lib/types'
import { Button } from '@/components/ui'
import { RoleSummaryPanel } from '@/components/game/RoleSummaryPanel'

interface RoleCardDisplayProps {
  card: RoleCard & { hints?: unknown }
  caseInfo?: PublicCaseInfo | null
}

export function RoleCardDisplay({ card, caseInfo }: RoleCardDisplayProps) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="card-glass rounded-3xl overflow-hidden border border-gold/15">
      <div className="relative p-6 text-center space-y-3 bg-gradient-to-b from-gold/5 to-transparent">
        <div className="text-5xl mb-2">{ROLE_EMOJI[card.role]}</div>
        <p className="label-sm opacity-70">بطاقتك السرية</p>
        <h2 className="font-display text-3xl text-parch-100">{ROLE_LABELS[card.role]}</h2>
      </div>

      <div className="border-t border-white/10" />

      {!revealed ? (
        <div className="text-center py-6 px-5">
          <div className="text-4xl mb-3 opacity-30">🔒</div>
          <p className="text-ink-400 text-sm mb-5">
            معلوماتك السرية محمية
            <br />
            <span className="text-xs text-ink-600">اضغط للكشف — لا يراها أحد سواك</span>
          </p>
          <Button variant="ghost" onClick={() => setRevealed(true)} className="mx-auto">
            🔍 اكشف بطاقتك
          </Button>
        </div>
      ) : (
        <div className="p-4 animate-fade-up">
          <RoleSummaryPanel card={card} caseInfo={caseInfo} />
        </div>
      )}
    </div>
  )
}
