import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, FileSpreadsheet, FileText, ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import Page from '../components/Page';
import Card from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Empty from '../components/Empty';
import StatCard from '../components/StatCard';
import { Field, Input, Select, Textarea } from '../components/Input';
import { api } from '../lib/api';
import { formatDZD, formatNumber, todayISO } from '../lib/format';
import { saveExcel, savePdf } from '../lib/export';
import type { CryptoTrade as CryptoTradeT, Settings } from '../types';

const COMMON_COINS = ['USDT', 'BTC', 'ETH', 'BNB', 'TRX', 'SOL'];

export default function CryptoTrade() {
  const [trades, setTrades] = useState<CryptoTradeT[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    trade_type: 'buy' as 'buy' | 'sell',
    coin: 'USDT',
    quantity: '',
    price_per_unit_dzd: '',
    counterparty: '',
    notes: '',
    traded_on: todayISO(),
  });

  const load = async () => {
    const [t, s] = await Promise.all([api.listCryptoTrades(), api.getSettings()]);
    setTrades(t);
    setSettings(s);
  };

  useEffect(() => {
    load();
  }, []);

  // Suggest default USDT price = USD-to-DZD rate
  useEffect(() => {
    if (showModal && settings && !form.price_per_unit_dzd && form.coin === 'USDT') {
      setForm((f) => ({ ...f, price_per_unit_dzd: settings.usd_to_dzd_default }));
    }
  }, [showModal, settings, form.price_per_unit_dzd, form.coin]);

  const totals = useMemo(() => {
    const totalBuy = trades
      .filter((t) => t.trade_type === 'buy')
      .reduce((acc, t) => acc + t.total_dzd, 0);
    const totalSell = trades
      .filter((t) => t.trade_type === 'sell')
      .reduce((acc, t) => acc + t.total_dzd, 0);

    // Per-coin holdings: net quantity bought - sold
    const holdings: Record<string, { qty: number; avgBuyPrice: number }> = {};
    for (const t of [...trades].sort((a, b) => a.traded_on.localeCompare(b.traded_on))) {
      if (!holdings[t.coin]) holdings[t.coin] = { qty: 0, avgBuyPrice: 0 };
      const h = holdings[t.coin];
      if (t.trade_type === 'buy') {
        const newQty = h.qty + t.quantity;
        const newCost = h.qty * h.avgBuyPrice + t.quantity * t.price_per_unit_dzd;
        h.avgBuyPrice = newQty > 0 ? newCost / newQty : 0;
        h.qty = newQty;
      } else {
        h.qty -= t.quantity;
      }
    }

    return { totalBuy, totalSell, profit: totalSell - totalBuy, holdings };
  }, [trades]);

  const previewTotal = useMemo(() => {
    return (Number(form.quantity) || 0) * (Number(form.price_per_unit_dzd) || 0);
  }, [form.quantity, form.price_per_unit_dzd]);

  const onCreate = async () => {
    const q = Number(form.quantity);
    const p = Number(form.price_per_unit_dzd);
    if (!form.coin.trim() || !q || !p) return;
    await api.createCryptoTrade({
      trade_type: form.trade_type,
      coin: form.coin.trim().toUpperCase(),
      quantity: q,
      price_per_unit_dzd: p,
      counterparty: form.counterparty || null,
      notes: form.notes || null,
      traded_on: form.traded_on,
    });
    setForm({
      trade_type: 'buy',
      coin: 'USDT',
      quantity: '',
      price_per_unit_dzd: '',
      counterparty: '',
      notes: '',
      traded_on: todayISO(),
    });
    setShowModal(false);
    await load();
  };

  const onDelete = async (id: number) => {
    if (!confirm('حذف هذه العملية؟')) return;
    await api.deleteCryptoTrade(id);
    await load();
  };

  const exportExcel = () =>
    saveExcel(
      trades.map((t) => ({
        التاريخ: t.traded_on,
        العملية: t.trade_type === 'buy' ? 'شراء' : 'بيع',
        العملة: t.coin,
        الكمية: t.quantity,
        السعر_للوحدة_DZD: t.price_per_unit_dzd,
        المجموع_DZD: t.total_dzd,
        الطرف_المقابل: t.counterparty ?? '',
      })),
      'عملات',
      'crypto-trades.xlsx'
    );

  const exportPdf = () =>
    savePdf(
      'Crypto Trades',
      ['Date', 'Type', 'Coin', 'Qty', 'Price (DZD)', 'Total (DZD)', 'Counterparty'],
      trades.map((t) => [
        t.traded_on,
        t.trade_type === 'buy' ? 'Buy' : 'Sell',
        t.coin,
        t.quantity,
        t.price_per_unit_dzd,
        t.total_dzd,
        t.counterparty ?? '',
      ]),
      'crypto-trades.pdf'
    );

  return (
    <Page
      title="تجارة العملات الإلكترونية"
      description="شراء وبيع USDT والعملات الرقمية مع تتبع الربح والخسارة"
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
            عملية جديدة
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="إجمالي الشراء"
          value={formatDZD(totals.totalBuy)}
          icon={ArrowDownLeft}
          tone="default"
        />
        <StatCard
          label="إجمالي البيع"
          value={formatDZD(totals.totalSell)}
          icon={ArrowUpRight}
          tone="positive"
        />
        <StatCard
          label="صافي الربح/الخسارة"
          value={formatDZD(totals.profit)}
          icon={Wallet}
          tone={totals.profit >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <Card title="الأرصدة الحالية (محسوبة من الصفقات)">
        {Object.keys(totals.holdings).length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد أرصدة بعد.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(totals.holdings).map(([coin, h]) => (
              <div
                key={coin}
                className="border border-slate-200 rounded-lg p-3 bg-slate-50"
              >
                <p className="text-xs text-slate-500">{coin}</p>
                <p className="font-bold text-slate-900">{formatNumber(h.qty, 4)}</p>
                {h.avgBuyPrice > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    متوسط الشراء: {formatDZD(h.avgBuyPrice)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="السجل">
        {trades.length === 0 ? (
          <Empty
            message="لا توجد عمليات بعد. أضف أول صفقة USDT."
            action={
              <Button onClick={() => setShowModal(true)}>
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
                  <th className="py-2 px-3 font-medium">العملية</th>
                  <th className="py-2 px-3 font-medium">العملة</th>
                  <th className="py-2 px-3 font-medium">الكمية</th>
                  <th className="py-2 px-3 font-medium">السعر/الوحدة</th>
                  <th className="py-2 px-3 font-medium">المجموع</th>
                  <th className="py-2 px-3 font-medium">الطرف المقابل</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-700">{t.traded_on}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          t.trade_type === 'buy'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {t.trade_type === 'buy' ? 'شراء' : 'بيع'}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-medium">{t.coin}</td>
                    <td className="py-2 px-3">{formatNumber(t.quantity, 4)}</td>
                    <td className="py-2 px-3 text-slate-600">
                      {formatDZD(t.price_per_unit_dzd)}
                    </td>
                    <td
                      className={`py-2 px-3 font-semibold ${
                        t.trade_type === 'buy' ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {t.trade_type === 'buy' ? '-' : '+'} {formatDZD(t.total_dzd)}
                    </td>
                    <td className="py-2 px-3 text-slate-600">{t.counterparty ?? '-'}</td>
                    <td className="py-2 px-3 text-left">
                      <button
                        onClick={() => onDelete(t.id)}
                        className="text-rose-600 hover:bg-rose-50 p-1.5 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="صفقة عملة رقمية جديدة"
        maxWidth="max-w-xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              إلغاء
            </Button>
            <Button onClick={onCreate}>إضافة</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="نوع العملية">
            <Select
              value={form.trade_type}
              onChange={(e) =>
                setForm({ ...form, trade_type: e.target.value as 'buy' | 'sell' })
              }
            >
              <option value="buy">شراء</option>
              <option value="sell">بيع</option>
            </Select>
          </Field>
          <Field label="العملة">
            <div className="flex gap-2">
              <Input
                value={form.coin}
                onChange={(e) => setForm({ ...form, coin: e.target.value.toUpperCase() })}
                list="common-coins"
                placeholder="USDT"
              />
              <datalist id="common-coins">
                {COMMON_COINS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </Field>
          <Field label="الكمية">
            <Input
              type="number"
              step="0.0001"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </Field>
          <Field label="السعر للوحدة (DZD)" hint="افتراضي = سعر الدولار في الإعدادات">
            <Input
              type="number"
              step="0.01"
              value={form.price_per_unit_dzd}
              onChange={(e) => setForm({ ...form, price_per_unit_dzd: e.target.value })}
            />
          </Field>
          <Field label="التاريخ">
            <Input
              type="date"
              value={form.traded_on}
              onChange={(e) => setForm({ ...form, traded_on: e.target.value })}
            />
          </Field>
          <Field label="الطرف المقابل">
            <Input
              value={form.counterparty}
              onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
              placeholder="اختياري"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="ملاحظات">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </Field>
          </div>
          <div className="sm:col-span-2 bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm">
            <span className="text-slate-600">المجموع المحسوب:</span>{' '}
            <span className="font-bold text-primary-700">{formatDZD(previewTotal)}</span>
          </div>
        </div>
      </Modal>
    </Page>
  );
}
