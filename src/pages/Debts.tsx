import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  FileSpreadsheet,
  FileText,
  ArrowDownCircle,
  ArrowUpCircle,
  Scale,
} from 'lucide-react';
import Page from '../components/Page';
import Card from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Empty from '../components/Empty';
import StatCard from '../components/StatCard';
import { Field, Input, Select, Textarea } from '../components/Input';
import { api } from '../lib/api';
import { formatDZD, todayISO } from '../lib/format';
import { saveExcel, savePdf } from '../lib/export';
import type { Debt } from '../types';

type Filter = 'all' | 'open' | 'settled';

export default function Debts() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [filter, setFilter] = useState<Filter>('open');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    person_name: '',
    direction: 'owed_to_me' as 'owed_to_me' | 'i_owe',
    amount_dzd: '',
    description: '',
    due_date: '',
  });

  const load = async () => {
    setDebts(await api.listDebts());
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    // Summaries count only open (unsettled) debts — settled debts no longer
    // represent active capital positions.
    const open = debts.filter((d) => !d.is_settled);
    const owedToMe = open
      .filter((d) => d.direction === 'owed_to_me')
      .reduce((a, d) => a + d.amount_dzd, 0);
    const iOwe = open
      .filter((d) => d.direction === 'i_owe')
      .reduce((a, d) => a + d.amount_dzd, 0);
    return { owedToMe, iOwe, net: owedToMe - iOwe };
  }, [debts]);

  const filtered = useMemo(() => {
    if (filter === 'open') return debts.filter((d) => !d.is_settled);
    if (filter === 'settled') return debts.filter((d) => !!d.is_settled);
    return debts;
  }, [debts, filter]);

  const onCreate = async () => {
    const amount = Number(form.amount_dzd);
    if (!form.person_name.trim() || !amount || amount <= 0) return;
    await api.createDebt({
      person_name: form.person_name.trim(),
      direction: form.direction,
      amount_dzd: amount,
      description: form.description || null,
      due_date: form.due_date || null,
    });
    setForm({
      person_name: '',
      direction: 'owed_to_me',
      amount_dzd: '',
      description: '',
      due_date: '',
    });
    setShowModal(false);
    await load();
  };

  const onToggle = async (d: Debt) => {
    await api.toggleDebtSettled(d.id, !d.is_settled);
    await load();
  };

  const onDelete = async (id: number) => {
    if (!confirm('حذف هذا الدين؟')) return;
    await api.deleteDebt(id);
    await load();
  };

  const exportExcel = () =>
    saveExcel(
      debts.map((d) => ({
        الاسم: d.person_name,
        الاتجاه: d.direction === 'owed_to_me' ? 'لّلو' : 'عليّ',
        المبلغ_DZD: d.amount_dzd,
        تاريخ_الاستحقاق: d.due_date ?? '',
        مُسدّد: d.is_settled ? 'نعم' : 'لا',
        ملاحظات: d.description ?? '',
      })),
      'الديون',
      'debts.xlsx'
    );

  const exportPdf = () =>
    savePdf(
      'Debts',
      ['Name', 'Direction', 'Amount (DZD)', 'Due', 'Settled', 'Notes'],
      debts.map((d) => [
        d.person_name,
        d.direction === 'owed_to_me' ? 'Owed to me' : 'I owe',
        d.amount_dzd,
        d.due_date ?? '',
        d.is_settled ? 'Yes' : 'No',
        d.description ?? '',
      ]),
      'debts.pdf'
    );

  return (
    <Page
      title="الديون"
      description="متابعة الديون في الاتجاهين: اللي عليّ واللي لّلو"
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={exportExcel}>
            <FileSpreadsheet size={14} />
            Excel
          </Button>
          <Button variant="secondary" size="sm" onClick={exportPdf}>
            <FileText size={14} />
            PDF
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} />
            دين جديد
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="مستحقات لي (لّلو)"
          value={formatDZD(totals.owedToMe)}
          icon={ArrowDownCircle}
          tone="positive"
        />
        <StatCard
          label="مستحقات عليّ"
          value={formatDZD(totals.iOwe)}
          icon={ArrowUpCircle}
          tone="negative"
        />
        <StatCard
          label="الصافي"
          value={formatDZD(totals.net)}
          icon={Scale}
          tone={totals.net >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <div className="border-b border-slate-200 flex gap-1">
        {(
          [
            ['open', `النشطة (${debts.filter((d) => !d.is_settled).length})`],
            ['settled', `المُسددة (${debts.filter((d) => d.is_settled).length})`],
            ['all', `الكل (${debts.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <Empty
            message="لا توجد ديون في هذا العرض."
            action={
              <Button onClick={() => setShowModal(true)}>
                <Plus size={16} />
                دين جديد
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((d) => (
              <div
                key={d.id}
                className={`flex items-center justify-between border rounded-lg px-3 py-2 ${
                  d.is_settled
                    ? 'border-slate-200 bg-slate-50 opacity-60'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={!!d.is_settled}
                    onChange={() => onToggle(d)}
                    className="w-4 h-4 accent-primary-600"
                    title={d.is_settled ? 'إلغاء التسديد' : 'تعليم كمُسدَّد'}
                  />
                  <div>
                    <p className={`font-medium ${d.is_settled ? 'line-through' : ''}`}>
                      {d.person_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {d.direction === 'owed_to_me' ? 'يدين لي' : 'أدين له'}
                      {d.due_date && ` • تاريخ الاستحقاق: ${d.due_date}`}
                      {d.description && ` • ${d.description}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-bold ${
                      d.direction === 'owed_to_me' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {formatDZD(d.amount_dzd)}
                  </span>
                  <button
                    onClick={() => onDelete(d.id)}
                    className="text-rose-600 hover:bg-rose-50 p-1.5 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="دين جديد"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              إلغاء
            </Button>
            <Button onClick={onCreate}>إضافة</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="اسم الشخص">
            <Input
              value={form.person_name}
              onChange={(e) => setForm({ ...form, person_name: e.target.value })}
              placeholder="مثال: أحمد"
            />
          </Field>
          <Field label="النوع">
            <Select
              value={form.direction}
              onChange={(e) =>
                setForm({ ...form, direction: e.target.value as 'owed_to_me' | 'i_owe' })
              }
            >
              <option value="owed_to_me">يدين لي (لّلو)</option>
              <option value="i_owe">أدين له (عليّ)</option>
            </Select>
          </Field>
          <Field label="المبلغ (DZD)">
            <Input
              type="number"
              step="0.01"
              value={form.amount_dzd}
              onChange={(e) => setForm({ ...form, amount_dzd: e.target.value })}
            />
          </Field>
          <Field label="تاريخ الاستحقاق">
            <Input
              type="date"
              value={form.due_date || todayISO()}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </Field>
          <Field label="ملاحظات">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="اختياري"
            />
          </Field>
        </div>
      </Modal>
    </Page>
  );
}
