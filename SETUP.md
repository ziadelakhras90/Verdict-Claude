# ⚖️ قاعة المحكمة — دليل الإعداد الكامل

---

## الترتيب الصحيح للإعداد

### 1. Supabase — المتطلبات الأساسية

**أ) أنشئ مشروعاً جديداً على [supabase.com](https://supabase.com)**

**ب) فعّل Anonymous Sign-ins ← لا تنسَ هذه الخطوة**
```
Authentication → Providers → Anonymous → Enable
```

**ج) فعّل Realtime على الجداول ← مطلوب للتحديث الفوري**
```
Database → Replication → Source tables
```
فعّل: `game_rooms` · `room_players` · `game_events` · `verdicts` · `game_results`

**د) نفّذ SQL Migrations بهذا الترتيب الحرفي**

في **SQL Editor**، نفّذ كل ملف كاملاً وتحقق من ظهور "complete ✓":

| # | الملف |
|---|---|
| 1 | `supabase/migrations/001_full_schema.sql` |
| 2 | `supabase/migrations/002_more_cases.sql` |
| 3 | `supabase/migrations/003_fix_status_constraint.sql` |
| 4 | `supabase/migrations/004_grants_and_stats.sql` |
| 5 | `supabase/migrations/005_event_fix_presence_cleanup.sql` |
| 6 | `supabase/migrations/006_complete_rls_rewrite.sql` |
| 7 | `supabase/migrations/007_fix_get_room_by_code.sql` |
| 8 | `supabase/migrations/008_fix_missing_functions_and_grants.sql` |

**هـ) احفظ بيانات الاتصال**
```
Project Settings → API
  • Project URL    → VITE_SUPABASE_URL
  • anon public   → VITE_SUPABASE_ANON_KEY
```

---

### 2. تشغيل المشروع محلياً

```bash
npm install
cp .env.example .env
# عدّل .env بقيمتي Supabase
npm run dev
# → http://localhost:5173
```

---

### 3. نشر Edge Functions (5 دوال)

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase functions deploy start-game
supabase functions deploy begin-session
supabase functions deploy advance-session
supabase functions deploy submit-verdict
supabase functions deploy reveal-truth
```

تحقق في **Edge Functions** أن الخمسة ظهروا.

---

### 4. النشر على Netlify

1. GitHub → Netlify → **Add new site → Import from Git**
2. Build: `npm run build` · Publish: `dist`
3. Environment variables:
   ```
   VITE_SUPABASE_URL      = https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJ...
   ```
4. في Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://your-site.netlify.app`
   - Redirect URLs: `https://your-site.netlify.app/**`

---

### 5. اختبار end-to-end

افتح 4 نوافذ أو أجهزة مختلفة:

1. **نافذة 1 (المضيف):** ابدأ اللعب → أدخل اسمك → إنشاء غرفة → انتظر
2. **نوافذ 2-4:** ابدأ اللعب → أدخل أسماء مختلفة → الانضمام بالكود
3. ✓ اللاعبون يظهرون فوراً بدون refresh
4. الكل يضغط "جاهز" ✓ يظهر فوراً
5. المضيف يضغط "ابدأ المحاكمة"
6. الكل ينتقل لبطاقات الأدوار ✓
7. المضيف يضغط "ابدأ الجلسة الأولى"
8. القاضي ينتقل تلقائياً لصفحة JudgePanel ✓
9. القاضي ينهي الجلسات ويصدر الحكم ✓
10. المضيف أو القاضي يكشف الحقيقة ✓
11. النتائج تظهر للجميع ✓

---

### 6. إضافة قضايا

في **Table Editor**:

**`case_templates`:**
| العمود | النوع | المثال |
|---|---|---|
| title | text | "القاضي المرتشي" |
| category | text | murder / fraud / theft |
| difficulty | int | 1, 2, أو 3 |
| min_players | int | 4 |
| max_players | int | 6 |
| public_summary | text | الوصف العام للقضية |
| public_facts | jsonb | `["حقيقة 1", "حقيقة 2"]` |
| hidden_truth | text | ما جرى فعلاً (يُكشف في النهاية) |
| actual_verdict | text | "guilty" أو "innocent" |
| is_active | bool | true |

**`case_role_cards`** — صف واحد لكل دور:
| العمود | القيمة |
|---|---|
| case_id | UUID من case_templates |
| role | defendant / defense_attorney / prosecutor / judge / deputy / witness |
| private_info | المعلومات السرية لهذا الدور |
| win_condition | شرط الفوز |

---

### 7. حل المشاكل الشائعة

| المشكلة | الحل |
|---|---|
| "Anonymous sign-ins are disabled" | فعّل Anonymous Auth في Supabase |
| اللاعبون لا يظهرون فوراً | فعّل Realtime على الجداول |
| "لا توجد قضايا لـ X لاعبين" | نفّذ migration 002، وتأكد من `is_active = true` |
| Edge Function 401 | تأكد من نشر الـ 5 دوال كاملة |
| "Database error" عند الدخول | نفّذ migration 006 (يُصلح trigger الـ profiles) |
| صفحة تعيد التوجيه بشكل غريب | امسح localStorage وأعد التحميل |
| القاضي لا يستطيع إصدار الحكم | تأكد من نشر `submit-verdict` function |
