import type { PublicCaseInfo, Role, RoleCard } from '@/lib/types'

const ROLE_PLAYBOOK: Record<Role, { focus: string[]; pressure: string[]; prompts: string[] }> = {
  defendant: {
    focus: ['احمِ نفسك من التناقض', 'قدّم رواية ثابتة', 'لا تمنح خصمك تفاصيل لا تحتاجها'],
    pressure: ['سؤالك الأول: من يستفيد من اتهامك؟', 'كرّر أن الظن لا يكفي للإدانة'],
    prompts: ['أين كنت بالضبط وقت الحادث؟', 'من يستطيع تأكيد كلامك؟', 'ما أكثر نقطة يستغلها الادعاء ضدك؟'],
  },
  defense_attorney: {
    focus: ['اكسر العلاقة بين الدافع والجريمة', 'ابحث عن ثغرة في الشهادة', 'ذكّر القاضي بعبء الإثبات'],
    pressure: ['اعترض على القفز للاستنتاجات', 'اطلب تفاصيل دقيقة من كل شاهد'],
    prompts: ['ما الدليل المادي المباشر؟', 'هل رأيت المتهم يفعلها أم تفترض فقط؟', 'من المستفيد الحقيقي؟'],
  },
  prosecutor: {
    focus: ['اربط بين الدافع والفرصة', 'حاصر التناقضات', 'حوّل الشكوك إلى تسلسل منطقي'],
    pressure: ['اسأل عن التوقيت والسلوك والدافع', 'واجه الدفاع بما يهمله من حقائق'],
    prompts: ['لماذا كان سلوك المتهم مريبًا؟', 'ما الحلقة الأضعف في رواية الدفاع؟', 'أي شاهد يدعم تسلسل الاتهام؟'],
  },
  judge: {
    focus: ['وازن بين الروايات', 'اطلب إجابات محددة', 'اضبط إيقاع الجلسة'],
    pressure: ['استخدم السؤال لاستخراج الحقيقة', 'اقطع التكرار وانتقل للنقطة الحاسمة'],
    prompts: ['ما أهم نقطة غير محسومة حتى الآن؟', 'من قدّم رواية متماسكة؟', 'هل يوجد تناقض يجب توضيحه فورًا؟'],
  },
  deputy: {
    focus: ['رتّب النقاش', 'التقط التناقضات الصغيرة', 'قدّم أسئلة متابعة ذكية'],
    pressure: ['لخّص ما قيل حتى الآن', 'ذكّر القاضي بالنقطة التي تحتاج جوابًا'],
    prompts: ['من غيّر كلامه بين بداية الجلسة ونهايتها؟', 'أي شاهد يحتاج سؤال متابعة؟', 'ما الحقيقة التي لم يُجب عنها أحد؟'],
  },
  witness: {
    focus: ['التزم بما رأيت فقط', 'فرّق بين الحقيقة والانطباع', 'لا تبالغ'],
    pressure: ['إذا لم تكن متأكدًا قل ذلك', 'دقّة الشهادة أهم من كثرتها'],
    prompts: ['ما الذي رأيته بعينك؟', 'ما الذي سمعته لا ما افترضته؟', 'ما التفصيل الذي تتذكره بوضوح؟'],
  },
}

function normalizeHints(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === 'string')
  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .flatMap(([key, value]) => {
        if (Array.isArray(value)) {
          return value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => `${key}: ${item}`)
        }
        if (typeof value === 'string') return [`${key}: ${value}`]
        return []
      })
  }
  return []
}

export function getRolePlaybook(role: Role) {
  return ROLE_PLAYBOOK[role]
}

export function buildRoleSummary(card: RoleCard & { hints?: unknown }, caseInfo?: PublicCaseInfo | null) {
  const playbook = getRolePlaybook(card.role)
  const hintLines = normalizeHints(card.hints)
  const publicFacts = Array.isArray(caseInfo?.public_facts) ? caseInfo?.public_facts.slice(0, 3) : []

  return {
    focus: playbook.focus,
    pressure: playbook.pressure,
    prompts: playbook.prompts,
    publicFacts,
    hints: hintLines,
  }
}
