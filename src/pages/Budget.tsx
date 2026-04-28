import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, FileSpreadsheet, FileText, HandCoins, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { LongPressRow, LongPressDiv } from '../components/LongPressRow';
import Page from '../components/Page';
import Card from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Empty from '../components/Empty';
import { Field, Input, Select, Textarea } from '../components/Input';
import { api } from '../lib/api';
import { formatDZD, todayISO } from '../lib/format';
import { savePdf, saveExcel } from '../lib/export';
import type { BudgetTransaction, Category, Debt, Settings } from '../types';

type Tab = 'transactions' | 'debts';

export default function Budget() {
  const [tab, setTab] = useState<Tab>('transactions');
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [editingDebtId, setEditingDebtId] = useState<number | null>(null);

  const [tx, setTx] = useState({
    type: 'expense' as 'income' | 'expense',
    category_id: '',
    amount_dzd: '',
    description: '',
    occurred_on: todayISO(),
  });

  const [debt, setDebt] = useState({
    person_name: '',
    direction: 'owed_to_me' as 'owed_to_me' | 'i_owe',
    amount_dzd: '',
    description: '',
    due_date: '',
  });

  const load = async () => {
    const [t, c, d, s] = await Promise.all([
      api.listBudget(),
      api.listCategories(),
      api.listDebts(),
      api.getSettings(),
    ]);
    setTransactions(t);
    setCategories(c);
    setDebts(d);
    setSettings(s);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredCats = useMemo(
    () => categories.filter((c) => c.type === tx.type),
    [categories, tx.type]
  );

  const monthBudget = settings ? Number(settings.monthly_budget_dzd) || 0 : 0;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthExpense = transactions
    .filter((t) => t.type === 'expense' && t.occurred_on.startsWith(currentMonth))
    .reduce((acc, t) => acc + t.amount_dzd, 0);
  const currentMonthIncome = transactions
    .filter((t) => t.type === 'income' && t.occurred_on.startsWith(currentMonth))
    .reduce((acc, t) => acc + t.amount_dzd, 0);

  const resetTxForm = () => {
    setTx({
      type: 'expense',
      category_id: '',
      amount_dzd: '',
      description: '',
      occurred_on: todayISO(),
    });
    setEditingTxId(null);
  };

  const openTxCreate = () => {
    resetTxForm();
    setShowTxModal(true);
  };

  const openTxEdit = (t: BudgetTransaction) => {
    setTx({
      type: t.type,
      category_id: t.category_id != null ? String(t.category_id) : '',
      amount_dzd: String(t.amount_dzd),
      description: t.description ?? '',
      occurred_on: t.occurred_on,
    });
    setEditingTxId(t.id);
    setShowTxModal(true);
  };

  const onSubmitTx = async () => {
    const amount = Number(tx.amount_dzd);
    if (!amount || amount <= 0) return;
    const payload = {
      type: tx.type,
      category_id: tx.category_id ? Number(tx.category_id) : null,
      amount_dzd: amount,
      description: tx.description,
      occurred_on: tx.occurred_on,
    };
    if (editingTxId != null) {
      await api.updateBudget(editingTxId, payload);
    } else {
      await api.createBudget(payload);
    }
    resetTxForm();
    setShowTxModal(false);
    await load();
  };

  const onDeleteTx = async (id: number) => {
    if (!confirm('حذف هذه العملية؟')) return;
    await api.deleteBudget(id);
    await load();
  };

  const resetDebtForm = () => {
    setDebt({
      person_name: '',
      direction: 'owed_to_me',
      amount_dzd: '',
      description: '',
      due_date: '',
    });
    setEditingDebtId(null);
  };

  const openDebtCreate = () => {
    resetDebtForm();
    setShowDebtModal(true);
  };

  const openDebtEdit = (d: Debt) => {
    setDebt({
      person_name: d.person_name,
      direction: d.direction,
      amount_dzd: String(d.amount_dzd),
      description: d.description ?? '',
      due_date: d.due_date ?? '',
    });
    setEditingDebtId(d.id);
    setShowDebtModal(true);
  };

  const onSubmitDebt = async () => {
    const amount = Number(debt.amount_dzd);
    if (!debt.person_name.trim() || !amount || amount <= 0) return;
    const payload = {
      person_name: debt.person_name.trim(),
      direction: debt.direction,
      amount_dzd: amount,
      description: debt.description || null,
      due_date: debt.due_date || null,
    };
    if (editingDebtId != null) {
      await api.updateDebt(editingDebtId, payload);
    } else {
      await api.createDebt(payload);
    }
    resetDebtForm();
    setShowDebtModal(false);
    await load();
  };

  const onToggleDebt = async (d: Debt) => {
    await api.toggleDebtSettled(d.id, !d.is_settled);
    await load();
  };

  const onDeleteDebt = async (id: number) => {
    if (!confirm('حذف هذا الدين؟')) return;
    await api.deleteDebt(id);
    await load();
  };

  const exportTxExcel = () =>
    saveExcel(
      transactions.map((t) => ({
        التاريخ: t.occurred_on,
        النوع: t.type === 'income' ? 'دخل' : 'مصروف',
        الفئة: t.category_name ?? '-',
        المبلغ_DZD: t.amount_dzd,
        الوصف: t.description ?? '',
      })),
      'الميزانية',
      'budget-transactions.xlsx'
    );

  const exportTxPdf = () =>
    savePdf(
      'كشف عمليات الميزانية',
      ['Date', 'Type', 'Category', 'Amount (DZD)', 'Description'],
      transactions.map((t) => [
        t.occurred_on,
        t.type === 'income' ? 'Income' : 'Expense',
        t.category_name ?? '-',
        t.amount_dzd,
        t.description ?? '',
      ]),
      'budget-transactions.pdf'
    );

  return (
    <Page
      title="الميزانية الشخصية"
      description="الراتب، المصاريف، والديون بالدينار الجزائري"
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={exportTxExcel}>
            <FileSpreadsheet size={14} />
            Excel
          </Button>
          <Button variant="secondary" size="sm" onClick={exportTxPdf}>
            <FileText size={14} />
            PDF
          </Button>
          {tab === 'transactions' ? (
            <Button onClick={openTxCreate}>
              <Plus size={16} />
              عملية جديدة
            </Button>
          ) : (
            <Button onClick={openDebtCreate}>
              <Plus size={16} />
              دين جديد
            </Button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <ArrowDownCircle className="text-emerald-600" size={28} />
            <div>
              <p className="text-xs text-slate-500">دخل الشهر الحالي</p>
              <p className="text-xl font-bold text-emerald-700">{formatDZD(currentMonthIncome)}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <ArrowUpCircle className="text-rose-600" size={28} />
            <div>
              <p className="text-xs text-slate-500">مصاريف الشهر الحالي</p>
              <p className="text-xl font-bold text-rose-700">{formatDZD(currentMonthExpense)}</p>
              {monthBudget > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  من أصل {formatDZD(monthBudget)} ({Math.round((currentMonthExpense / monthBudget) * 100)}%)
                </p>
              )}
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <HandCoins className="text-amber-600" size={28} />
            <div>
              <p className="text-xs text-slate-500">صافي الشهر الحالي</p>
              <p
                className={`text-xl font-bold ${
                  currentMonthIncome - currentMonthExpense >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatDZD(currentMonthIncome - currentMonthExpense)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="border-b border-slate-200 flex gap-1">
        <button
          onClick={() => setTab('transactions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'transactions'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          العمليات
        </button>
        <button
          onClick={() => setTab('debts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'debts'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          الديون ({debts.filter((d) => !d.is_settled).length})
        </button>
      </div>

      {tab === 'transactions' && (
        <Card>
          {transactions.length === 0 ? (
            <Empty
              message="لا توجد عمليات بعد. ابدأ بإضافة الراتب والمصاريف."
              action={
                <Button onClick={openTxCreate}>
                  <Plus size={16} />
                  عملية جديدة
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right border-b border-slate-200 text-slate-600">
                    <th className="py-2 px-3 font-medium">التاريخ</th>
                    <th className="py-2 px-3 font-medium">النوع</th>
                    <th className="py-2 px-3 font-medium">الفئة</th>
                    <th className="py-2 px-3 font-medium">المبلغ</th>
                    <th className="py-2 px-3 font-medium">الوصف</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <LongPressRow
                      key={t.id}
                      onEdit={() => openTxEdit(t)}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-2 px-3 text-slate-700">{t.occurred_on}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            t.type === 'income'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {t.type === 'income' ? 'دخل' : 'مصروف'}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {t.category_name ? (
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ backgroundColor: t.category_color ?? '#cbd5e1' }}
                            />
                            {t.category_name}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td
                        className={`py-2 px-3 font-semibold ${
                          t.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {t.type === 'income' ? '+' : '-'} {formatDZD(t.amount_dzd)}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{t.description ?? '-'}</td>
                      <td className="py-2 px-3 text-left">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openTxEdit(t)}
                            className="text-primary-600 hover:bg-primary-50 p-1.5 rounded"
                            title="تعديل (أو اضغط مطولاً)"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => onDeleteTx(t.id)}
                            className="text-rose-600 hover:bg-rose-50 p-1.5 rounded"
                            title="حذف"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </LongPressRow>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'debts' && (
        <Card>
          {debts.length === 0 ? (
            <Empty
              message="لا توجد ديون مسجلة."
              action={
                <Button onClick={openDebtCreate}>
                  <Plus size={16} />
                  دين جديد
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {debts.map((d) => (
                <LongPressDiv
                  key={d.id}
                  onEdit={() => openDebtEdit(d)}
                  className={`flex items-center justify-between border rounded-lg px-3 py-2 ${
                    d.is_settled ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!d.is_settled}
                      onChange={() => onToggleDebt(d)}
                      className="w-4 h-4 accent-primary-600"
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
                      onClick={() => openDebtEdit(d)}
                      className="text-primary-600 hover:bg-primary-50 p-1.5 rounded"
                      title="تعديل (أو اضغط مطولاً)"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteDebt(d.id)}
                      className="text-rose-600 hover:bg-rose-50 p-1.5 rounded"
                      title="حذف"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </LongPressDiv>
              ))}
            </div>
          )}
        </Card>
      )}

      <Modal
        open={showTxModal}
        onClose={() => {
          setShowTxModal(false);
          resetTxForm();
        }}
        title={editingTxId != null ? 'تعديل عملية' : 'عملية جديدة'}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowTxModal(false);
                resetTxForm();
              }}
            >
              إلغاء
            </Button>
            <Button onClick={onSubmitTx}>{editingTxId != null ? 'حفظ' : 'إضافة'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="النوع">
            <Select
              value={tx.type}
              onChange={(e) =>
                setTx({ ...tx, type: e.target.value as 'income' | 'expense', category_id: '' })
              }
            >
              <option value="expense">مصروف</option>
              <option value="income">دخل</option>
            </Select>
          </Field>
          <Field label="الفئة">
            <Select
              value={tx.category_id}
              onChange={(e) => setTx({ ...tx, category_id: e.target.value })}
            >
              <option value="">— بدون فئة —</option>
              {filteredCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="المبلغ (DZD)">
            <Input
              type="number"
              step="0.01"
              value={tx.amount_dzd}
              onChange={(e) => setTx({ ...tx, amount_dzd: e.target.value })}
              placeholder="مثال: 50000"
            />
          </Field>
          <Field label="التاريخ">
            <Input
              type="date"
              value={tx.occurred_on}
              onChange={(e) => setTx({ ...tx, occurred_on: e.target.value })}
            />
          </Field>
          <Field label="الوصف">
            <Textarea
              value={tx.description}
              onChange={(e) => setTx({ ...tx, description: e.target.value })}
              rows={2}
              placeholder="اختياري"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={showDebtModal}
        onClose={() => {
          setShowDebtModal(false);
          resetDebtForm();
        }}
        title={editingDebtId != null ? 'تعديل دين' : 'دين جديد'}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowDebtModal(false);
                resetDebtForm();
              }}
            >
              إلغاء
            </Button>
            <Button onClick={onSubmitDebt}>{editingDebtId != null ? 'حفظ' : 'إضافة'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="اسم الشخص">
            <Input
              value={debt.person_name}
              onChange={(e) => setDebt({ ...debt, person_name: e.target.value })}
              placeholder="مثال: أحمد"
            />
          </Field>
          <Field label="النوع">
            <Select
              value={debt.direction}
              onChange={(e) =>
                setDebt({
                  ...debt,
                  direction: e.target.value as 'owed_to_me' | 'i_owe',
                })
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
              value={debt.amount_dzd}
              onChange={(e) => setDebt({ ...debt, amount_dzd: e.target.value })}
            />
          </Field>
          <Field label="تاريخ الاستحقاق (اختياري)">
            <Input
              type="date"
              value={debt.due_date}
              onChange={(e) => setDebt({ ...debt, due_date: e.target.value })}
            />
          </Field>
          <Field label="الوصف">
            <Textarea
              value={debt.description}
              onChange={(e) => setDebt({ ...debt, description: e.target.value })}
              rows={2}
            />
          </Field>
        </div>
      </Modal>
    </Page>
  );
}
