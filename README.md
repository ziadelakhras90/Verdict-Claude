# ⚖️ قاعة المحكمة

لعبة أدوار اجتماعية تفاعلية — محكمة من المتصفح مباشرة.
مبنية بـ **React 18 + Vite + TypeScript + Supabase** — تُنشر على **Netlify**.

---

## الفكرة بسرعة

- كل لاعب يحصل على دور سري: متهم، محامي دفاع، محامي ادعاء، قاضٍ، نائب، شاهد
- ثلاث جلسات نقاش بمؤقت — كل لاعب يتحدث من منظور دوره
- القاضي يُصدر حكمه في النهاية
- تُكشف الحقيقة الفعلية — من فاز ومن خسر؟

---

## المتطلبات

- Node.js 18+
- حساب [Supabase](https://supabase.com)
- حساب [Netlify](https://netlify.com)
- Supabase CLI (للـ Edge Functions)

---

## الإعداد خطوة بخطوة

### 1. قاعدة البيانات

افتح Supabase Dashboard → **SQL Editor** ونفِّذ هذه الملفات **بالترتيب**:

```
supabase/migrations/001_full_schema.sql
supabase/migrations/002_more_cases.sql
supabase/migrations/003_fix_status_constraint.sql
supabase/migrations/004_grants_and_stats.sql
supabase/migrations/005_event_fix_presence_cleanup.sql
```

### 2. متغيرات البيئة

```bash
cp .env.example .env
```

عدِّل `.env`:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 3. تشغيل محلي

```bash
npm install
npm run dev
# → http://localhost:5173
```

### 4. Edge Functions

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_ID

supabase functions deploy start-game
supabase functions deploy begin-session
supabase functions deploy advance-session
supabase functions deploy reveal-truth
```

### 5. النشر على Netlify

1. ادفع الكود إلى GitHub
2. Netlify → **Add new site → Import from Git**
3. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy!

---

## مسار اللعبة الكامل

```
/              الصفحة الرئيسية
/auth          تسجيل دخول / إنشاء حساب
/setup         اختيار اسم اللاعب (مرة واحدة)
/create        إنشاء غرفة جديدة
/join/:code    الانضمام بالكود

/room/:id/lobby    غرفة الانتظار
                   ↓ host يضغط "ابدأ" [start-game]
/room/:id/card     كل لاعب يقرأ بطاقته السرية
                   ↓ host يضغط "ابدأ الجلسة 1" [begin-session]
/room/:id/session  جلسة 1 → 2 → 3  [advance-session]
                   القاضي → /room/:id/judge
                   ↓ بعد الجلسة 3
/room/:id/verdict  القاضي يصدر حكمه
                   ↓
/room/:id/reveal   كشف الحقيقة [reveal-truth]
                   ↓
/room/:id/results  النتائج + إحصائيات الفوز
```

---

## الأدوار وشروط الفوز

| الدور | يعرف الحقيقة؟ | شرط الفوز |
|---|---|---|
| المتهم | ✅ | صدور حكم البراءة |
| محامي الدفاع | ✅ | صدور حكم البراءة |
| محامي الادعاء | ❌ | صدور حكم الإدانة |
| القاضي | ❌ | حكمه يطابق الحقيقة |
| النائب | ❌ | الحكم يطابق الحقيقة |
| الشاهد | ❌ | الحكم يطابق الحقيقة |

---

## القضايا المضمّنة (3 قضايا)

| القضية | الفئة | الصعوبة | اللاعبون |
|---|---|---|---|
| السكرتيرة المختفية | قتل | ★★ | 4–6 |
| العقد المسروق | سرقة | ★ | 4–5 |
| رئيس الشركة المسموم | قتل | ★★★ | 5–6 |

### إضافة قضية جديدة

في Supabase Dashboard → Table Editor:

1. أضف صفاً في `case_templates` مع جميع الحقول
2. أضف بطاقة دور في `case_role_cards` لكل دور (حسب عدد اللاعبين)
3. تأكد: `is_active = true` و `actual_verdict = 'guilty' | 'innocent'`

---

## الأمان

| الجدول | من يقرأ؟ | من يكتب؟ |
|---|---|---|
| `case_templates` | ❌ (view فقط) | Service role |
| `public_case_info` (view) | Authenticated | — |
| `player_role_data` | صاحب الكارت فقط | Service role |
| `game_results` | أعضاء الغرفة بعد `reveal` | Service role |
| `game_events` | أعضاء الغرفة | أعضاء الغرفة (في `in_session`) |
| `verdicts` | أعضاء الغرفة | القاضي فقط |

`actual_verdict` و `hidden_truth` لا تصلان للـ client أبدًا — Edge Functions فقط.

---

## هيكل المشروع

```
src/
├── actions/         جميع عمليات Supabase (createRoom, joinRoom, startGame, ...)
├── components/
│   ├── game/        EventFeed, RoleCardDisplay, SessionTimer,
│   │                CountdownRing, CaseInfoPanel, GamePhaseBar
│   ├── layout/      AppShell, ProtectedRoute
│   ├── room/        PlayerList, HostTransferModal, InviteToast
│   └── ui/          Button, Card, Avatar, Input, Modal,
│                    Toast, Skeletons, ErrorBoundary, ConnectionLostOverlay
├── hooks/           useAuth, useRoom, useRoomGuard, useRoomMembership,
│                    usePresence, useSessionTimer, useToast, useCurrentUser
├── lib/             supabase.ts, types.ts, utils.ts
├── pages/           17 صفحة (lazy-loaded كل صفحة)
├── stores/          authStore, roomStore (Zustand)
└── router.tsx       React Router v6 + Suspense lazy

supabase/
├── config.toml
├── functions/       start-game, begin-session, advance-session, reveal-truth
└── migrations/      001–005
```

---

## البنية التقنية

- **Framework:** React 18 + Vite 5
- **Language:** TypeScript (صفر أخطاء)
- **Routing:** React Router v6 (lazy-loaded)
- **State:** Zustand
- **Backend:** Supabase (Auth + DB + Realtime + Edge Functions)
- **Styling:** Tailwind CSS
- **Fonts:** IBM Plex Sans Arabic + Playfair Display + IBM Plex Mono
- **Deploy:** Netlify (static)

### Bundle sizes (gzip)

| Chunk | Size |
|---|---|
| vendor-react | 66 KB |
| vendor-supabase | 52 KB |
| app entry | 5 KB |
| per-page chunks | 1–4 KB each |

---

## التوسع المستقبلي

- [ ] شاهد الزور / النائب المرتشي
- [ ] نظام نقاط متراكمة عبر مباريات
- [ ] وضع المتفرج (spectator mode)
- [ ] تصميم 2D مرئي / أنيميشن
- [ ] مؤثرات صوتية وموسيقى
- [ ] تاريخ المباريات لكل لاعب
- [ ] قضايا تتكشف تدريجياً (clues per round)
- [ ] نظام تصويت جماعي بدلاً من حكم فردي
