import type { PublicCaseInfo, RoleCard } from '@/lib/types'
import { ROLE_EMOJI, ROLE_LABELS } from '@/lib/types'
import { buildRoleSummary } from '@/lib/roleDetails'

interface RoleSummaryPanelProps {
  card: RoleCard & { hints?: unknown }
  caseInfo?: PublicCaseInfo | null
  compact?: boolean
}

export function RoleSummaryPanel({ card, caseInfo, compact = false }: RoleSummaryPanelProps) {
  const summary = buildRoleSummary(card, caseInfo)

  return (
    <div className={`card-glass rounded-2xl ${compact ? 'p-4' : 'p-5'} space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-sm">بطاقتك السرية</p>
          <h3 className="font-display text-gold text-2xl flex items-center gap-2">
            <span>{ROLE_EMOJI[card.role]}</span>
            <span>{ROLE_LABELS[card.role]}</span>
          </h3>
        </div>
        {card.knows_truth && (
          <span className="text-[11px] px-2 py-1 rounded-full border border-gold/30 bg-gold/10 text-gold">
            يعرف الحقيقة
          </span>
        )}
      </div>

      <div className="space-y-2">
        <p className="label-sm text-gold/70">ما تعرفه</p>
        <p className="text-sm text-parch-200 leading-relaxed whitespace-pre-line">{card.private_info}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="label-sm text-green-400/70">هدفك</p>
          <p className="text-sm text-parch-200 leading-relaxed">{card.win_condition}</p>
        </div>
        <div className="space-y-2">
          <p className="label-sm text-blue-400/70">كيف تلعب الدور</p>
          <ul className="space-y-1.5 text-sm text-parch-200">
            {summary.focus.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-gold/50">◆</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {summary.hints.length > 0 && (
        <div className="space-y-2 rounded-xl border border-gold/10 bg-black/20 p-3">
          <p className="label-sm text-gold/70">خيوط إضافية لك</p>
          <ul className="space-y-1.5 text-sm text-parch-200">
            {summary.hints.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-gold/50">◆</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="label-sm text-purple-300/70">أسئلة أو مداخلات مقترحة</p>
          <ul className="space-y-1.5 text-sm text-parch-200">
            {summary.prompts.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-gold/50">◆</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <p className="label-sm text-red-300/70">نقاط ضغط في النقاش</p>
          <ul className="space-y-1.5 text-sm text-parch-200">
            {summary.pressure.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-gold/50">◆</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {summary.publicFacts.length > 0 && (
        <div className="space-y-2 rounded-xl border border-white/5 bg-black/10 p-3">
          <p className="label-sm text-ink-300">حقائق عامة يمكنك البناء عليها</p>
          <ul className="space-y-1.5 text-sm text-parch-200">
            {summary.publicFacts.map((fact) => (
              <li key={fact} className="flex gap-2">
                <span className="text-gold/50">◆</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
