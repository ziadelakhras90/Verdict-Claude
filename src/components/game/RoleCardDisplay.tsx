import { useState } from 'react'
import type { RoleCard, Role } from '@/lib/types'
import { ROLE_LABELS, ROLE_EMOJI, ROLE_COLOR_CLASS } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

interface RoleCardDisplayProps {
  card:       RoleCard
  caseTitle?: string
}

export function RoleCardDisplay({ card, caseTitle }: RoleCardDisplayProps) {
  const [revealed, setRevealed] = useState(false)
  const colorClass = ROLE_COLOR_CLASS[card.role as Role]

  return (
    <div className={cn(
      'rounded-2xl border-2 p-6 space-y-5 transition-all duration-500 animate-card-reveal',
      colorClass
    )}>
      {/* Header */}
      <div className="text-center space-y-1">
        {caseTitle && (
          <p className="label-sm text-center mb-3">قضية: {caseTitle}</p>
        )}
        <div className="text-5xl mb-2">{ROLE_EMOJI[card.role as Role]}</div>
        <p className="label-sm opacity-70">دورك في هذه القضية</p>
        <h2 className="font-display text-3xl text-parch-100">
          {ROLE_LABELS[card.role as Role]}
        </h2>
      </div>

      <div className="border-t border-white/10" />

      {/* Secret info — tap to reveal */}
      {!revealed ? (
        <div className="text-center py-6">
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
        <div className="space-y-4 animate-fade-up">
          <div className="bg-black/30 rounded-xl p-4 space-y-2">
            <p className="label-sm text-gold/70">معلوماتك السرية</p>
            <p className="text-sm text-parch-200 leading-relaxed whitespace-pre-line">
              {card.private_info}
            </p>
          </div>
          <div className="bg-black/20 rounded-xl p-4 space-y-2 border border-white/5">
            <p className="label-sm text-green-400/70">شرط الفوز</p>
            <p className="text-sm text-parch-200 leading-relaxed">
              {card.win_condition}
            </p>
          </div>
          {card.knows_truth && (
            <div className="bg-gold/10 border border-gold/30 rounded-xl p-3 text-center">
              <p className="text-xs text-gold">
                ⚠️ أنت تعرف الحقيقة — استخدمها بذكاء ولا تكشفها صراحةً
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
