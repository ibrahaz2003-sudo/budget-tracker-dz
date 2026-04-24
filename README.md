# Budget Tracker DZ

تطبيق سطح مكتب متكامل لإدارة الميزانية الشخصية والتجارة بالدينار الجزائري، مع ثلاثة أقسام رئيسية:

1. **الميزانية الشخصية** — الراتب، المصاريف، الفئات، تنبيهات تجاوز الميزانية، وتتبع الديون (لّلو / عليّ).
2. **تجارة قطع الحاسوب** — مشتريات باليورو مع تحويل تلقائي لتكلفة الدينار، مبيعات، وحساب الربح والخسارة.
3. **تجارة العملات الإلكترونية (USDT وغيرها)** — شراء وبيع، تتبع الأرصدة الحالية، ومتوسط سعر الشراء، والصافي.

## المميزات

- لوحة تحكم رئيسية مع رسوم بيانية شهرية (دخل، مصاريف، أرباح التجارة).
- تخزين محلي على جهازك بـ SQLite (لا يوجد سيرفر، خصوصية كاملة).
- أسعار صرف افتراضية قابلة للتعديل في كل عملية (مناسب للسوق السوداء/الرسمي).
- تصدير التقارير إلى Excel (xlsx) و PDF.
- واجهة عربية RTL باستخدام خط Cairo.
- حد ميزانية شهري مع تنبيه عند التجاوز.

## التقنيات

- **Electron** + **Vite** (سطح مكتب)
- **React 18** + **TypeScript** + **Tailwind CSS**
- **better-sqlite3** للتخزين المحلي
- **Recharts** للرسوم البيانية
- **jsPDF** + **SheetJS (xlsx)** للتصدير
- **lucide-react** للأيقونات

## التشغيل

```bash
npm install
npm run dev
```

سيتم فتح التطبيق تلقائياً عند بدء dev server.

## البناء

```bash
npm run build           # ينتج ملف تثبيت في مجلد release/
npm run build:vite      # بناء الواجهة فقط دون أيقونات التثبيت
npm run package         # تجميع غير مُثبَّت في release/<platform>-unpacked
```

> ملاحظة: `electron-builder` يحتاج اتصال إنترنت في أول تشغيل لتنزيل ملفات Electron الخاصة بالمنصة.

## الفحوصات

```bash
npm run typecheck
npm run lint
```

## بنية المشروع

```
budget-tracker-dz/
├── electron/           # العملية الرئيسية (Main)، قاعدة البيانات، IPC
│   ├── main.ts
│   ├── preload.ts
│   ├── db.ts           # تعريف الجداول والترقية
│   └── ipc.ts          # معالجات IPC لكل العمليات
├── src/                # الواجهة (React)
│   ├── pages/          # الصفحات الخمسة (Dashboard, Budget, Computer, Crypto, Settings)
│   ├── components/     # مكونات قابلة لإعادة الاستخدام
│   ├── lib/            # API wrapper، صياغة الأرقام، التصدير
│   ├── types.ts        # أنواع TypeScript
│   └── App.tsx
├── index.html
├── vite.config.ts
└── package.json
```

## مكان قاعدة البيانات

تُحفظ قاعدة البيانات في مجلد المستخدم الخاص بـ Electron:

- **Linux**: `~/.config/Budget Tracker DZ/budget-tracker.db`
- **Windows**: `%APPDATA%\Budget Tracker DZ\budget-tracker.db`
- **macOS**: `~/Library/Application Support/Budget Tracker DZ/budget-tracker.db`

يمكن نسخ هذا الملف لعمل نسخة احتياطية.

## الترخيص

MIT
