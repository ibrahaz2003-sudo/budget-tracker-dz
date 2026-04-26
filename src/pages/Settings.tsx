import { useEffect, useRef, useState } from 'react';
import { Save, Plus, Trash2, Upload, Download } from 'lucide-react';
import Page from '../components/Page';
import Card from '../components/Card';
import Button from '../components/Button';
import { Field, Input, Select } from '../components/Input';
import Modal from '../components/Modal';
import { api } from '../lib/api';
import { runBackupExport, runBackupImport } from '../lib/backup';
import type { Category, Settings as SettingsType } from '../types';

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const [newCat, setNewCat] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense',
    monthly_limit: '',
    color: '#3b82f6',
  });

  const load = async () => {
    const [s, c] = await Promise.all([api.getSettings(), api.listCategories()]);
    setSettings(s);
    setCategories(c);
  };

  useEffect(() => {
    load();
  }, []);

  if (!settings) {
    return (
      <Page title="الإعدادات">
        <p className="text-slate-500">جارٍ التحميل...</p>
      </Page>
    );
  }

  const onSaveSettings = async () => {
    await Promise.all([
      api.setSetting('eur_to_dzd_default', settings.eur_to_dzd_default),
      api.setSetting('usd_to_dzd_default', settings.usd_to_dzd_default),
      api.setSetting('monthly_budget_dzd', settings.monthly_budget_dzd),
    ]);
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2000);
  };

  const onCreateCategory = async () => {
    if (!newCat.name.trim()) return;
    await api.createCategory({
      name: newCat.name.trim(),
      type: newCat.type,
      monthly_limit: newCat.monthly_limit ? Number(newCat.monthly_limit) : null,
      color: newCat.color,
    });
    setNewCat({ name: '', type: 'expense', monthly_limit: '', color: '#3b82f6' });
    setShowCatModal(false);
    await load();
  };

  const onDeleteCategory = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفئة؟ سيتم فصل جميع العمليات المرتبطة بها.')) return;
    await api.deleteCategory(id);
    await load();
  };

  const onBackupExport = async () => {
    setBackupBusy(true);
    setBackupStatus(null);
    try {
      const result = await runBackupExport();
      if (result === 'canceled') {
        setBackupStatus('تم الإلغاء.');
      } else if (result.startsWith('saved:')) {
        setBackupStatus(`تم الحفظ في: ${result.slice(6)}`);
      } else if (result.startsWith('shared:')) {
        setBackupStatus('فُتحت قائمة المشاركة — اختر Google Drive أو Dropbox أو أي خدمة.');
      } else {
        setBackupStatus('تم التحميل.');
      }
    } catch (e) {
      setBackupStatus(
        `خطأ: ${e instanceof Error ? e.message : 'فشل التصدير'}`
      );
    } finally {
      setBackupBusy(false);
      setTimeout(() => setBackupStatus(null), 8000);
    }
  };

  const onRestoreFilePicked = async (file: File) => {
    if (!confirm(
      'الاستعادة ستستبدل جميع البيانات الحالية بمحتوى الملف. متأكد؟'
    )) return;
    setBackupBusy(true);
    setBackupStatus(null);
    try {
      const r = await runBackupImport(file);
      setBackupStatus(`تمت الاستعادة بنجاح (${r.restored_tables} جدول).`);
      await load();
    } catch (e) {
      setBackupStatus(
        `خطأ: ${e instanceof Error ? e.message : 'فشل الاستعادة'}`
      );
    } finally {
      setBackupBusy(false);
      setTimeout(() => setBackupStatus(null), 8000);
    }
  };

  return (
    <Page
      title="الإعدادات"
      description="إعدادات أسعار الصرف الافتراضية، الميزانية الشهرية، وفئات المصاريف/الدخل"
      actions={
        <Button onClick={onSaveSettings}>
          <Save size={16} />
          حفظ
        </Button>
      }
    >
      {savedAt && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg px-4 py-2 text-sm">
          تم حفظ الإعدادات بنجاح
        </div>
      )}

      <Card title="أسعار الصرف الافتراضية">
        <p className="text-xs text-slate-500 mb-4">
          هذه القيم تُستخدم كأسعار افتراضية عند إضافة عمليات شراء/بيع. يمكنك تعديل السعر يدوياً في كل عملية.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="1 يورو (EUR) = ؟ دينار جزائري (DZD)" hint="السعر الذي تستخدمه فعلياً (سوق سوداء أو رسمي)">
            <Input
              type="number"
              step="0.01"
              value={settings.eur_to_dzd_default}
              onChange={(e) =>
                setSettings({ ...settings, eur_to_dzd_default: e.target.value })
              }
            />
          </Field>
          <Field label="1 دولار (USD) = ؟ دينار جزائري (DZD)">
            <Input
              type="number"
              step="0.01"
              value={settings.usd_to_dzd_default}
              onChange={(e) =>
                setSettings({ ...settings, usd_to_dzd_default: e.target.value })
              }
            />
          </Field>
          <Field label="حد الميزانية الشهرية (DZD)" hint="0 = بدون تنبيه">
            <Input
              type="number"
              step="100"
              value={settings.monthly_budget_dzd}
              onChange={(e) =>
                setSettings({ ...settings, monthly_budget_dzd: e.target.value })
              }
            />
          </Field>
        </div>
      </Card>

      <Card title="النسخ الاحتياطي والاستعادة">
        <p className="text-xs text-slate-500 mb-3">
          احفظ كل بياناتك في ملف واحد، وارفعه على Google Drive أو Dropbox أو
          واتساب للمزامنة بين أجهزتك. الاستعادة تستبدل البيانات الحالية.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onBackupExport} disabled={backupBusy}>
            <Download size={16} />
            تصدير نسخة احتياطية
          </Button>
          <Button
            variant="secondary"
            onClick={() => restoreInputRef.current?.click()}
            disabled={backupBusy}
          >
            <Upload size={16} />
            استعادة نسخة احتياطية
          </Button>
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onRestoreFilePicked(f);
              e.target.value = '';
            }}
          />
        </div>
        {backupStatus && (
          <p className="mt-3 text-sm text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
            {backupStatus}
          </p>
        )}
      </Card>

      <Card
        title="فئات الميزانية"
        actions={
          <Button size="sm" onClick={() => setShowCatModal(true)}>
            <Plus size={14} />
            فئة جديدة
          </Button>
        }
      >
        <div className="space-y-2">
          {categories.length === 0 && (
            <p className="text-sm text-slate-500">لا توجد فئات.</p>
          )}
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                <span className="font-medium text-slate-800">{c.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    c.type === 'income'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {c.type === 'income' ? 'دخل' : 'مصروف'}
                </span>
                {c.monthly_limit != null && (
                  <span className="text-xs text-slate-500">
                    حد شهري: {c.monthly_limit} DA
                  </span>
                )}
              </div>
              <button
                onClick={() => onDeleteCategory(c.id)}
                className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={showCatModal}
        onClose={() => setShowCatModal(false)}
        title="إضافة فئة جديدة"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCatModal(false)}>
              إلغاء
            </Button>
            <Button onClick={onCreateCategory}>إضافة</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="اسم الفئة">
            <Input
              value={newCat.name}
              onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
              placeholder="مثال: مواصلات"
            />
          </Field>
          <Field label="النوع">
            <Select
              value={newCat.type}
              onChange={(e) =>
                setNewCat({ ...newCat, type: e.target.value as 'income' | 'expense' })
              }
            >
              <option value="expense">مصروف</option>
              <option value="income">دخل</option>
            </Select>
          </Field>
          <Field label="الحد الشهري (اختياري)">
            <Input
              type="number"
              value={newCat.monthly_limit}
              onChange={(e) => setNewCat({ ...newCat, monthly_limit: e.target.value })}
              placeholder="مثلاً 10000"
            />
          </Field>
          <Field label="اللون">
            <Input
              type="color"
              value={newCat.color}
              onChange={(e) => setNewCat({ ...newCat, color: e.target.value })}
              className="h-10"
            />
          </Field>
        </div>
      </Modal>
    </Page>
  );
}
