# Test Plan — Budget Tracker DZ (PR #1)

Adversarial E2E tests run against the Electron app launched via `npm run dev`.
The dev window starts empty (DB is fresh in `app.getPath('userData')/budget-tracker.db`).

All assertions are chosen so that a broken implementation (e.g. wrong formula,
missing aggregation, broken filter) would produce a *different* visible value.

## Flow 1 — Settings: configure monthly budget + exchange rates

Goal: verify settings persist and influence other pages.

Evidence: `src/pages/Settings.tsx:90-122`, `electron/ipc.ts` `settings:set`.

Steps
1. Click **الإعدادات** in the left sidebar.
2. In "1 يورو (EUR) = ؟ دينار جزائري (DZD)" set value = `250`.
3. In "حد الميزانية الشهرية (DZD)" set value = `10000`.
4. Click **حفظ** (top-right of the page).

Pass criteria
- Green banner appears: `تم حفظ الإعدادات بنجاح`.
- EUR field value remains `250` after navigating away and back (persistence via IPC `settings:set` / `settings:get-all`).
- The preset EUR value in `tests 2/3` below auto-fills `250` in the purchase modal.

Fail if: banner absent, value resets on re-visit, or `240` (default) re-appears.

---

## Flow 2 — Budget: monthly budget alert fires only above threshold

Goal: prove the alert banner is driven by the *current month* expense vs. setting, not by a static toggle.

Evidence: `src/pages/Dashboard.tsx:78-88` (alert), `src/pages/Budget.tsx:63-70` (current month filter).

Steps
1. Click **الميزانية الشخصية** in the sidebar.
2. Click **عملية جديدة** (top-right).
3. In the modal: النوع = `مصروف`, الفئة = `طعام`, المبلغ (DZD) = `4000`, date = today.
4. Click **إضافة**.
5. Check top summary cards: `مصاريف الشهر الحالي` should show `4,000 DA` with hint `من أصل 10,000 DA (40%)`.
6. Click **الرئيسية** in sidebar.

Pass criteria (after 1 expense of 4000)
- Budget page header strip: "مصاريف الشهر الحالي" = `4,000 DA`, "40%" displayed.
- Dashboard shows **no** amber alert banner (since 4000 ≤ 10000).
- Dashboard "المصاريف الإجمالية" card shows `4,000 DA`.

7. Return to Budget page, add a second expense: الفئة `أخرى`, المبلغ = `7000`, today.

Pass criteria (after second expense, total = 11,000)
- Budget page: "مصاريف الشهر الحالي" = `11,000 DA`, "110%" hint.
- Dashboard: amber alert banner appears with text containing `تجاوزت الحد الشهري المحدد` and the values `11,000 DA` and `10,000 DA`.

Fail if: alert appears after 1st expense (false positive), or never appears after 2nd expense (false negative), or percentages are wrong.

---

## Flow 3 — Computer trade: EUR → DZD cost + sale profit math

Goal: prove both the purchase cost formula and the sale profit formula round-trip correctly.

Evidence: `electron/ipc.ts` `computer-purchases:create` (`total_cost_dzd = q*u*r + shipping`), `computer-sales:create` (`profit = q*(sale - cost)`), `src/pages/ComputerTrade.tsx:76-93`.

Steps
1. Click **تجارة قطع الحاسوب** in sidebar, stay on **المشتريات** tab.
2. Click **شراء جديد**.
3. Modal: اسم القطعة = `RTX 4070`, الكمية = `2`, سعر الوحدة (EUR) = `500`, سعر اليورو = `250` (pre-filled from settings), الشحن = `3000`.
4. Verify footer preview: `التكلفة الكلية المحسوبة: 253,000 DA` (= 2·500·250 + 3000).
5. Click **إضافة**.

Pass criteria
- Row inserted: `RTX 4070`, Qty `2`, `€500`, `250 DA`, `3,000 DA`, **total `253,000 DA`**.
- Top StatCard `إجمالي المشتريات` = `253,000 DA`.

6. Switch to **المبيعات** tab, click **بيع جديد**.
7. In the modal, choose the previous purchase in the dropdown; verify it pre-fills:
   - اسم القطعة = `RTX 4070`
   - تكلفة الوحدة (DZD) = `126,500.00` (= 253000/2)
8. Set الكمية = `1`, سعر البيع للوحدة (DZD) = `150000`.
9. Verify footer preview: الإيراد `150,000 DA`, التكلفة `126,500 DA`, **الربح `23,500 DA`**.
10. Click **إضافة**.

Pass criteria
- Sale row profit column = `23,500 DA` (green).
- Top StatCard `صافي الربح` = `23,500 DA`.

Fail if: any of those exact totals differ, or the cost auto-fill is wrong, or the profit sign flips.

---

## Flow 4 — Crypto: USDT holdings fold + weighted avg buy price

Goal: prove holdings are a *sequential fold* of buys/sells (not simple sums) and that avg buy price is weighted by quantity.

Evidence: `src/pages/CryptoTrade.tsx:48-73` (sorted fold by `traded_on`).

Steps
1. Click **العملات الإلكترونية** in sidebar.
2. Click **عملية جديدة**. نوع = `شراء`, العملة = `USDT`, الكمية = `100`, السعر للوحدة = `220`, date = today.
3. Click **إضافة**.
4. Add another **عملية جديدة**: نوع = `شراء`, USDT, الكمية = `100`, السعر = `230`, today.
5. Add a third: نوع = `بيع`, USDT, الكمية = `50`, السعر = `240`, today.

Pass criteria
- Holdings card shows USDT qty = `150` (100+100−50).
- USDT avg buy price = `225 DA` (= (100·220 + 100·230)/200). Sells must NOT change avg.
- إجمالي الشراء = `45,000 DA` (= 100·220 + 100·230).
- إجمالي البيع = `12,000 DA` (= 50·240).
- صافي الربح/الخسارة = `−33,000 DA` (red, negative) — proves net = sell − buy, not profit per unit.

Fail if: qty ≠ 150 (implies subtraction broken), avg ≠ 225 (implies unweighted), net ≠ −33,000 (implies aggregation bug).

---

## Flow 5 — Dashboard aggregation and monthly chart

Goal: prove the dashboard cross-aggregates all 3 sections and renders the chart once data exists.

Evidence: `electron/ipc.ts` `dashboard:summary` and `dashboard:monthly`, `src/pages/Dashboard.tsx`.

Steps
1. Click **الرئيسية** in sidebar.

Pass criteria (given flows 2–4 already ran)
- `الدخل الإجمالي` = `0 DA`.
- `المصاريف الإجمالية` = `11,000 DA`.
- `صافي الميزانية الشخصية` = `−11,000 DA` (red).
- `ربح تجارة قطع الحاسوب` = `23,500 DA`.
- `ربح تجارة العملات (USDT)` = `−33,000 DA`.
- `الصافي الكلي (مع التجارة)` = `−11,000 + 23,500 + (−33,000) = −20,500 DA`.
- Monthly bar chart shows a visible `مصاريف` bar for the current month (≠ empty-state text).
- Amber alert banner present (same as Flow 2 step 7).

Fail if: any card shows an obviously wrong number, totals sign flipped, or the chart's empty-state text remains despite data.

---

## Flow 6 — Debt tracking (both directions + settle)

Goal: confirm the two debt directions aggregate to distinct dashboard cards.

Evidence: `electron/ipc.ts` `debts:list / debts:create / debts:toggle-settled`, `src/pages/Budget.tsx` Debts tab.

Steps
1. Budget page → **الديون** tab → **دين جديد**.
2. Add: اسم = `أحمد`, النوع = `يدين لي (لّلو)`, المبلغ = `5000`. Click إضافة.
3. Add another: اسم = `محل العمل`, النوع = `أدين له (عليّ)`, المبلغ = `3000`.

Pass criteria
- Two rows shown; no line-through.
- Dashboard `مستحقات لي (لّلو)` = `5,000 DA`, `مستحقات عليّ` = `3,000 DA`.

4. Check the checkbox on the `أحمد` row.

Pass criteria
- Row appears line-through and faded.
- Dashboard `مستحقات لي (لّلو)` drops to `0 DA` (settled debts excluded — see `ipc.ts:dashboard:summary` WHERE `is_settled=0`).

Fail if: settled debt still counts in dashboard total, or the two directions show on the same card.

---

## Notes / Skipped

- **PDF/Excel export** — the save dialog is a native OS dialog; I'll exercise the button and confirm the dialog appears but will cancel rather than save to avoid persisted artifacts. Will capture the dialog in the recording.
- **Category CRUD** — covered implicitly by Flow 2 (uses seeded categories).
- **Persistence across restarts** — out of scope for this session; the SQLite write path is exercised transitively by every flow.
