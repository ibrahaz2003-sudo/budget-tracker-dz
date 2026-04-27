import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Mail, FileSpreadsheet, FileText, Package, ShoppingCart, TrendingUp } from 'lucide-react';
import Page from '../components/Page';
import Card from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Empty from '../components/Empty';
import StatCard from '../components/StatCard';
import { Field, Input, Select, Textarea } from '../components/Input';
import { api } from '../lib/api';
import { formatDZD, formatEUR, formatUSD, todayISO } from '../lib/format';
import { saveExcel, savePdf } from '../lib/export';
import { parseOrderEmail } from '../lib/emailParser';
import type { ComputerPurchase, ComputerSale, Settings } from '../types';

type Tab = 'purchases' | 'sales';

export default function ComputerTrade() {
  const [tab, setTab] = useState<Tab>('purchases');
  const [purchases, setPurchases] = useState<ComputerPurchase[]>([]);
  const [sales, setSales] = useState<ComputerSale[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<number | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailText, setEmailText] = useState('');
  const [emailPreview, setEmailPreview] = useState<ReturnType<typeof parseOrderEmail> | null>(
    null
  );

  const [purchase, setPurchase] = useState({
    item_name: '',
    quantity: '1',
    purchase_currency: 'EUR' as 'EUR' | 'USD',
    unit_cost: '',
    currency_to_dzd_rate: '',
    shipping_eur: '0',
    shipping_eur_rate: '',
    supplier: '',
    notes: '',
    purchased_on: todayISO(),
  });

  const [sale, setSale] = useState({
    purchase_id: '',
    item_name: '',
    quantity: '1',
    unit_sale_price_dzd: '',
    unit_cost_dzd: '',
    customer: '',
    notes: '',
    sold_on: todayISO(),
  });

  const load = async () => {
    const [p, s, st] = await Promise.all([
      api.listComputerPurchases(),
      api.listComputerSales(),
      api.getSettings(),
    ]);
    setPurchases(p);
    setSales(s);
    setSettings(st);
  };

  useEffect(() => {
    load();
  }, []);

  // Initialize default rates when opening purchase modal (or when currency
  // changes). Currency rate defaults to the setting for the chosen currency;
  // EUR rate (always used for shipping) defaults to the EUR setting.
  useEffect(() => {
    if (!showPurchaseModal || !settings) return;
    setPurchase((p) => {
      const updates: Partial<typeof p> = {};
      const defaultForCurrency =
        p.purchase_currency === 'USD'
          ? settings.usd_to_dzd_default
          : settings.eur_to_dzd_default;
      if (!p.currency_to_dzd_rate) updates.currency_to_dzd_rate = defaultForCurrency;
      if (!p.shipping_eur_rate) updates.shipping_eur_rate = settings.eur_to_dzd_default;
      return Object.keys(updates).length ? { ...p, ...updates } : p;
    });
  }, [showPurchaseModal, settings, purchase.purchase_currency]);

  const onChangePurchaseCurrency = (next: 'EUR' | 'USD') => {
    if (!settings) {
      setPurchase((p) => ({ ...p, purchase_currency: next }));
      return;
    }
    const defaultForNext =
      next === 'USD' ? settings.usd_to_dzd_default : settings.eur_to_dzd_default;
    setPurchase((p) => ({
      ...p,
      purchase_currency: next,
      // Always refresh the per-currency rate to the setting default when the
      // user switches currency, so the modal makes the new rate visible.
      currency_to_dzd_rate: defaultForNext,
    }));
  };

  const totals = useMemo(() => {
    const totalPurchasesDzd = purchases.reduce((acc, p) => acc + p.total_cost_dzd, 0);
    const totalRevenueDzd = sales.reduce((acc, s) => acc + s.total_revenue_dzd, 0);
    const totalProfitDzd = sales.reduce((acc, s) => acc + s.profit_dzd, 0);
    return { totalPurchasesDzd, totalRevenueDzd, totalProfitDzd };
  }, [purchases, sales]);

  const purchasePreview = useMemo(() => {
    const q = Number(purchase.quantity) || 0;
    const u = Number(purchase.unit_cost) || 0;
    const r = Number(purchase.currency_to_dzd_rate) || 0;
    const shipEur = Number(purchase.shipping_eur) || 0;
    const shipRate = Number(purchase.shipping_eur_rate) || 0;
    const itemsDzd = q * u * r;
    const shippingDzd = shipEur * shipRate;
    return { itemsDzd, shippingDzd, total: itemsDzd + shippingDzd };
  }, [purchase]);

  const salePreview = useMemo(() => {
    const q = Number(sale.quantity) || 0;
    const sp = Number(sale.unit_sale_price_dzd) || 0;
    const cp = Number(sale.unit_cost_dzd) || 0;
    return {
      revenue: q * sp,
      cost: q * cp,
      profit: q * (sp - cp),
    };
  }, [sale]);

  const resetPurchaseForm = () => {
    setPurchase({
      item_name: '',
      quantity: '1',
      purchase_currency: 'EUR',
      unit_cost: '',
      currency_to_dzd_rate: settings?.eur_to_dzd_default ?? '',
      shipping_eur: '0',
      shipping_eur_rate: settings?.eur_to_dzd_default ?? '',
      supplier: '',
      notes: '',
      purchased_on: todayISO(),
    });
    setEditingPurchaseId(null);
  };

  const openPurchaseCreate = () => {
    resetPurchaseForm();
    setShowPurchaseModal(true);
  };

  const openPurchaseEdit = (p: ComputerPurchase) => {
    setPurchase({
      item_name: p.item_name,
      quantity: String(p.quantity),
      purchase_currency: (p.purchase_currency as 'EUR' | 'USD') || 'EUR',
      unit_cost: String(p.unit_cost_eur),
      currency_to_dzd_rate: String(p.eur_to_dzd_rate),
      shipping_eur: String(p.shipping_eur ?? 0),
      shipping_eur_rate: String(
        p.shipping_eur_rate ?? settings?.eur_to_dzd_default ?? ''
      ),
      supplier: p.supplier ?? '',
      notes: p.notes ?? '',
      purchased_on: p.purchased_on,
    });
    setEditingPurchaseId(p.id);
    setShowPurchaseModal(true);
  };

  const onSubmitPurchase = async () => {
    const q = Number(purchase.quantity);
    const u = Number(purchase.unit_cost);
    const r = Number(purchase.currency_to_dzd_rate);
    const shipEur = Number(purchase.shipping_eur) || 0;
    const shipRate = Number(purchase.shipping_eur_rate);
    if (!purchase.item_name.trim() || !q || !u || !r) return;
    if (shipEur > 0 && !shipRate) return;
    const payload = {
      item_name: purchase.item_name.trim(),
      quantity: q,
      purchase_currency: purchase.purchase_currency,
      unit_cost: u,
      currency_to_dzd_rate: r,
      shipping_eur: shipEur,
      shipping_eur_rate: shipRate || Number(settings?.eur_to_dzd_default ?? 0),
      supplier: purchase.supplier || null,
      notes: purchase.notes || null,
      purchased_on: purchase.purchased_on,
    };
    if (editingPurchaseId != null) {
      await api.updateComputerPurchase(editingPurchaseId, payload);
    } else {
      await api.createComputerPurchase(payload);
    }
    resetPurchaseForm();
    setShowPurchaseModal(false);
    await load();
  };

  const onAnalyzeEmail = () => {
    if (!emailText.trim()) return;
    setEmailPreview(parseOrderEmail(emailText));
  };

  const onUseParsedEmail = () => {
    if (!emailPreview) return;
    const p = emailPreview;
    const currency = p.currency ?? 'EUR';
    const defaultRate =
      currency === 'USD'
        ? settings?.usd_to_dzd_default ?? ''
        : settings?.eur_to_dzd_default ?? '';
    setPurchase({
      item_name: p.item_name,
      quantity: String(p.quantity || 1),
      purchase_currency: currency,
      unit_cost: p.unit_cost != null ? String(p.unit_cost) : '',
      currency_to_dzd_rate: defaultRate,
      shipping_eur: p.shipping_eur != null ? String(p.shipping_eur) : '0',
      shipping_eur_rate: settings?.eur_to_dzd_default ?? '',
      supplier: p.supplier ?? '',
      notes: p.notes,
      purchased_on: p.purchased_on ?? todayISO(),
    });
    setEditingPurchaseId(null);
    setEmailText('');
    setEmailPreview(null);
    setShowEmailModal(false);
    setShowPurchaseModal(true);
  };

  const onDeletePurchase = async (id: number) => {
    if (!confirm('حذف هذه الفاتورة؟')) return;
    await api.deleteComputerPurchase(id);
    await load();
  };

  const resetSaleForm = () => {
    setSale({
      purchase_id: '',
      item_name: '',
      quantity: '1',
      unit_sale_price_dzd: '',
      unit_cost_dzd: '',
      customer: '',
      notes: '',
      sold_on: todayISO(),
    });
    setEditingSaleId(null);
  };

  const openSaleCreate = () => {
    resetSaleForm();
    setShowSaleModal(true);
  };

  const openSaleEdit = (s: ComputerSale) => {
    setSale({
      purchase_id: s.purchase_id != null ? String(s.purchase_id) : '',
      item_name: s.item_name,
      quantity: String(s.quantity),
      unit_sale_price_dzd: String(s.unit_sale_price_dzd),
      unit_cost_dzd: String(s.unit_cost_dzd),
      customer: s.customer ?? '',
      notes: s.notes ?? '',
      sold_on: s.sold_on,
    });
    setEditingSaleId(s.id);
    setShowSaleModal(true);
  };

  const onSubmitSale = async () => {
    const q = Number(sale.quantity);
    const sp = Number(sale.unit_sale_price_dzd);
    const cp = Number(sale.unit_cost_dzd);
    if (!sale.item_name.trim() || !q || !sp || cp == null) return;
    const payload = {
      purchase_id: sale.purchase_id ? Number(sale.purchase_id) : null,
      item_name: sale.item_name.trim(),
      quantity: q,
      unit_sale_price_dzd: sp,
      unit_cost_dzd: cp,
      customer: sale.customer || null,
      notes: sale.notes || null,
      sold_on: sale.sold_on,
    };
    if (editingSaleId != null) {
      await api.updateComputerSale(editingSaleId, payload);
    } else {
      await api.createComputerSale(payload);
    }
    resetSaleForm();
    setShowSaleModal(false);
    await load();
  };

  const onDeleteSale = async (id: number) => {
    if (!confirm('حذف هذا البيع؟')) return;
    await api.deleteComputerSale(id);
    await load();
  };

  // When user selects a related purchase in sale modal, prefill cost & item name
  const onPickPurchaseForSale = (purchaseId: string) => {
    const p = purchases.find((x) => x.id === Number(purchaseId));
    if (!p) {
      setSale((s) => ({ ...s, purchase_id: '' }));
      return;
    }
    const unitCostDzd = p.total_cost_dzd / p.quantity;
    setSale((s) => ({
      ...s,
      purchase_id: purchaseId,
      item_name: s.item_name || p.item_name,
      unit_cost_dzd: unitCostDzd.toFixed(2),
    }));
  };

  const exportPurchasesExcel = () =>
    saveExcel(
      purchases.map((p) => ({
        التاريخ: p.purchased_on,
        القطعة: p.item_name,
        الكمية: p.quantity,
        عملة_الشراء: p.purchase_currency,
        سعر_الوحدة: p.unit_cost_eur,
        سعر_العملة_DZD: p.eur_to_dzd_rate,
        الشحن_EUR: p.shipping_eur ?? '',
        سعر_اليورو_للشحن_DZD: p.shipping_eur_rate ?? '',
        الشحن_DZD: p.shipping_dzd,
        التكلفة_الكلية_DZD: p.total_cost_dzd,
        المورد: p.supplier ?? '',
      })),
      'مشتريات',
      'computer-purchases.xlsx'
    );

  const exportSalesExcel = () =>
    saveExcel(
      sales.map((s) => ({
        التاريخ: s.sold_on,
        القطعة: s.item_name,
        الكمية: s.quantity,
        سعر_البيع_DZD: s.unit_sale_price_dzd,
        التكلفة_DZD: s.unit_cost_dzd,
        الإيراد_DZD: s.total_revenue_dzd,
        الربح_DZD: s.profit_dzd,
        الزبون: s.customer ?? '',
      })),
      'مبيعات',
      'computer-sales.xlsx'
    );

  const exportPurchasesPdf = () =>
    savePdf(
      'Computer Parts Purchases',
      [
        'Date',
        'Item',
        'Qty',
        'Cur',
        'Unit Cost',
        'Cur Rate',
        'Ship (EUR)',
        'EUR Rate',
        'Ship (DZD)',
        'Total DZD',
        'Supplier',
      ],
      purchases.map((p) => [
        p.purchased_on,
        p.item_name,
        p.quantity,
        p.purchase_currency,
        p.unit_cost_eur,
        p.eur_to_dzd_rate,
        p.shipping_eur ?? '-',
        p.shipping_eur_rate ?? '-',
        p.shipping_dzd,
        p.total_cost_dzd,
        p.supplier ?? '',
      ]),
      'computer-purchases.pdf'
    );

  const exportSalesPdf = () =>
    savePdf(
      'Computer Parts Sales',
      ['Date', 'Item', 'Qty', 'Sale (DZD)', 'Cost (DZD)', 'Revenue (DZD)', 'Profit (DZD)', 'Customer'],
      sales.map((s) => [
        s.sold_on,
        s.item_name,
        s.quantity,
        s.unit_sale_price_dzd,
        s.unit_cost_dzd,
        s.total_revenue_dzd,
        s.profit_dzd,
        s.customer ?? '',
      ]),
      'computer-sales.pdf'
    );

  return (
    <Page
      title="تجارة قطع الحاسوب"
      description="شراء باليورو، تحويل التكلفة للدينار الجزائري، حساب الربح"
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={tab === 'purchases' ? exportPurchasesExcel : exportSalesExcel}
          >
            <FileSpreadsheet size={14} />
            Excel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={tab === 'purchases' ? exportPurchasesPdf : exportSalesPdf}
          >
            <FileText size={14} />
            PDF
          </Button>
          {tab === 'purchases' ? (
            <>
              <Button variant="secondary" onClick={() => setShowEmailModal(true)}>
                <Mail size={16} />
                استيراد من بريد
              </Button>
              <Button onClick={openPurchaseCreate}>
                <Plus size={16} />
                شراء جديد
              </Button>
            </>
          ) : (
            <Button onClick={openSaleCreate}>
              <Plus size={16} />
              بيع جديد
            </Button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="إجمالي المشتريات"
          value={formatDZD(totals.totalPurchasesDzd)}
          icon={Package}
          tone="default"
        />
        <StatCard
          label="إجمالي الإيرادات"
          value={formatDZD(totals.totalRevenueDzd)}
          icon={ShoppingCart}
          tone="positive"
        />
        <StatCard
          label="صافي الربح"
          value={formatDZD(totals.totalProfitDzd)}
          icon={TrendingUp}
          tone={totals.totalProfitDzd >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <div className="border-b border-slate-200 flex gap-1">
        <button
          onClick={() => setTab('purchases')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'purchases'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          المشتريات ({purchases.length})
        </button>
        <button
          onClick={() => setTab('sales')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'sales'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          المبيعات ({sales.length})
        </button>
      </div>

      {tab === 'purchases' && (
        <Card>
          {purchases.length === 0 ? (
            <Empty
              message="لا توجد مشتريات بعد."
              action={
                <Button onClick={openPurchaseCreate}>
                  <Plus size={16} />
                  شراء جديد
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right border-b border-slate-200 text-slate-600">
                    <th className="py-2 px-3 font-medium">التاريخ</th>
                    <th className="py-2 px-3 font-medium">القطعة</th>
                    <th className="py-2 px-3 font-medium">الكمية</th>
                    <th className="py-2 px-3 font-medium">سعر الوحدة</th>
                    <th className="py-2 px-3 font-medium">سعر العملة</th>
                    <th className="py-2 px-3 font-medium">الشحن (EUR)</th>
                    <th className="py-2 px-3 font-medium">التكلفة الكلية</th>
                    <th className="py-2 px-3 font-medium">المورد</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-700">{p.purchased_on}</td>
                      <td className="py-2 px-3 font-medium">{p.item_name}</td>
                      <td className="py-2 px-3">{p.quantity}</td>
                      <td className="py-2 px-3">
                        {p.purchase_currency === 'USD'
                          ? formatUSD(p.unit_cost_eur)
                          : formatEUR(p.unit_cost_eur)}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {p.eur_to_dzd_rate} DA / {p.purchase_currency}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {p.shipping_eur != null
                          ? `${formatEUR(p.shipping_eur)} (${formatDZD(p.shipping_dzd)})`
                          : formatDZD(p.shipping_dzd)}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {formatDZD(p.total_cost_dzd)}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{p.supplier ?? '-'}</td>
                      <td className="py-2 px-3 text-left">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openPurchaseEdit(p)}
                            className="text-primary-600 hover:bg-primary-50 p-1.5 rounded"
                            title="تعديل"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => onDeletePurchase(p.id)}
                            className="text-rose-600 hover:bg-rose-50 p-1.5 rounded"
                            title="حذف"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'sales' && (
        <Card>
          {sales.length === 0 ? (
            <Empty
              message="لا توجد مبيعات بعد."
              action={
                <Button onClick={openSaleCreate}>
                  <Plus size={16} />
                  بيع جديد
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right border-b border-slate-200 text-slate-600">
                    <th className="py-2 px-3 font-medium">التاريخ</th>
                    <th className="py-2 px-3 font-medium">القطعة</th>
                    <th className="py-2 px-3 font-medium">الكمية</th>
                    <th className="py-2 px-3 font-medium">سعر البيع</th>
                    <th className="py-2 px-3 font-medium">التكلفة</th>
                    <th className="py-2 px-3 font-medium">الإيراد</th>
                    <th className="py-2 px-3 font-medium">الربح</th>
                    <th className="py-2 px-3 font-medium">الزبون</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-700">{s.sold_on}</td>
                      <td className="py-2 px-3 font-medium">{s.item_name}</td>
                      <td className="py-2 px-3">{s.quantity}</td>
                      <td className="py-2 px-3">{formatDZD(s.unit_sale_price_dzd)}</td>
                      <td className="py-2 px-3 text-slate-600">{formatDZD(s.unit_cost_dzd)}</td>
                      <td className="py-2 px-3">{formatDZD(s.total_revenue_dzd)}</td>
                      <td
                        className={`py-2 px-3 font-semibold ${
                          s.profit_dzd >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {formatDZD(s.profit_dzd)}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{s.customer ?? '-'}</td>
                      <td className="py-2 px-3 text-left">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openSaleEdit(s)}
                            className="text-primary-600 hover:bg-primary-50 p-1.5 rounded"
                            title="تعديل"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => onDeleteSale(s.id)}
                            className="text-rose-600 hover:bg-rose-50 p-1.5 rounded"
                            title="حذف"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={showPurchaseModal}
        onClose={() => {
          setShowPurchaseModal(false);
          resetPurchaseForm();
        }}
        title={editingPurchaseId != null ? 'تعديل عملية شراء' : 'عملية شراء جديدة'}
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowPurchaseModal(false);
                resetPurchaseForm();
              }}
            >
              إلغاء
            </Button>
            <Button onClick={onSubmitPurchase}>
              {editingPurchaseId != null ? 'حفظ' : 'إضافة'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="اسم القطعة">
            <Input
              value={purchase.item_name}
              onChange={(e) => setPurchase({ ...purchase, item_name: e.target.value })}
              placeholder="مثال: RTX 4070"
            />
          </Field>
          <Field label="الكمية">
            <Input
              type="number"
              min="1"
              value={purchase.quantity}
              onChange={(e) => setPurchase({ ...purchase, quantity: e.target.value })}
            />
          </Field>
          <Field label="عملة الشراء" hint="EUR أو USD (الشحن دائماً بالأورو)">
            <Select
              value={purchase.purchase_currency}
              onChange={(e) =>
                onChangePurchaseCurrency(e.target.value as 'EUR' | 'USD')
              }
            >
              <option value="EUR">EUR — يورو</option>
              <option value="USD">USD — دولار</option>
            </Select>
          </Field>
          <Field label={`سعر الوحدة (${purchase.purchase_currency})`}>
            <Input
              type="number"
              step="0.01"
              value={purchase.unit_cost}
              onChange={(e) => setPurchase({ ...purchase, unit_cost: e.target.value })}
            />
          </Field>
          <Field
            label={`سعر ${
              purchase.purchase_currency === 'USD' ? 'الدولار' : 'اليورو'
            } (DZD)`}
            hint="افتراضي من الإعدادات، يمكن تعديله"
          >
            <Input
              type="number"
              step="0.01"
              value={purchase.currency_to_dzd_rate}
              onChange={(e) =>
                setPurchase({ ...purchase, currency_to_dzd_rate: e.target.value })
              }
            />
          </Field>
          <Field label="الشحن والرسوم (EUR)" hint="المورد دائماً يفوتر الشحن بالأورو">
            <Input
              type="number"
              step="0.01"
              value={purchase.shipping_eur}
              onChange={(e) =>
                setPurchase({ ...purchase, shipping_eur: e.target.value })
              }
            />
          </Field>
          <Field
            label="سعر الأورو للشحن (DZD)"
            hint="يُستخدم لتحويل الشحن إلى الدينار"
          >
            <Input
              type="number"
              step="0.01"
              value={purchase.shipping_eur_rate}
              onChange={(e) =>
                setPurchase({ ...purchase, shipping_eur_rate: e.target.value })
              }
            />
          </Field>
          <Field label="التاريخ">
            <Input
              type="date"
              value={purchase.purchased_on}
              onChange={(e) => setPurchase({ ...purchase, purchased_on: e.target.value })}
            />
          </Field>
          <Field label="المورد">
            <Input
              value={purchase.supplier}
              onChange={(e) => setPurchase({ ...purchase, supplier: e.target.value })}
              placeholder="اختياري"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="ملاحظات">
              <Textarea
                value={purchase.notes}
                onChange={(e) => setPurchase({ ...purchase, notes: e.target.value })}
                rows={2}
              />
            </Field>
          </div>
          <div className="sm:col-span-2 bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm space-y-1">
            <div>
              <span className="text-slate-600">تكلفة القطع:</span>{' '}
              <span className="font-medium text-slate-800">
                {formatDZD(purchasePreview.itemsDzd)}
              </span>
            </div>
            <div>
              <span className="text-slate-600">تكلفة الشحن:</span>{' '}
              <span className="font-medium text-slate-800">
                {formatDZD(purchasePreview.shippingDzd)}
              </span>
            </div>
            <div>
              <span className="text-slate-600">التكلفة الكلية المحسوبة:</span>{' '}
              <span className="font-bold text-primary-700">
                {formatDZD(purchasePreview.total)}
              </span>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={showSaleModal}
        onClose={() => {
          setShowSaleModal(false);
          resetSaleForm();
        }}
        title={editingSaleId != null ? 'تعديل عملية بيع' : 'عملية بيع جديدة'}
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowSaleModal(false);
                resetSaleForm();
              }}
            >
              إلغاء
            </Button>
            <Button onClick={onSubmitSale}>
              {editingSaleId != null ? 'حفظ' : 'إضافة'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field
              label="القطعة المرتبطة (اختياري)"
              hint="اختيارها يملأ التكلفة تلقائياً"
            >
              <Select
                value={sale.purchase_id}
                onChange={(e) => onPickPurchaseForSale(e.target.value)}
              >
                <option value="">— بدون ربط —</option>
                {purchases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.item_name} • {p.purchased_on} • تكلفة الوحدة:{' '}
                    {formatDZD(p.total_cost_dzd / p.quantity)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="اسم القطعة">
            <Input
              value={sale.item_name}
              onChange={(e) => setSale({ ...sale, item_name: e.target.value })}
            />
          </Field>
          <Field label="الكمية">
            <Input
              type="number"
              min="1"
              value={sale.quantity}
              onChange={(e) => setSale({ ...sale, quantity: e.target.value })}
            />
          </Field>
          <Field label="سعر البيع للوحدة (DZD)">
            <Input
              type="number"
              step="0.01"
              value={sale.unit_sale_price_dzd}
              onChange={(e) => setSale({ ...sale, unit_sale_price_dzd: e.target.value })}
            />
          </Field>
          <Field label="تكلفة الوحدة (DZD)">
            <Input
              type="number"
              step="0.01"
              value={sale.unit_cost_dzd}
              onChange={(e) => setSale({ ...sale, unit_cost_dzd: e.target.value })}
            />
          </Field>
          <Field label="التاريخ">
            <Input
              type="date"
              value={sale.sold_on}
              onChange={(e) => setSale({ ...sale, sold_on: e.target.value })}
            />
          </Field>
          <Field label="الزبون">
            <Input
              value={sale.customer}
              onChange={(e) => setSale({ ...sale, customer: e.target.value })}
              placeholder="اختياري"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="ملاحظات">
              <Textarea
                value={sale.notes}
                onChange={(e) => setSale({ ...sale, notes: e.target.value })}
                rows={2}
              />
            </Field>
          </div>
          <div className="sm:col-span-2 bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm grid grid-cols-3 gap-2">
            <div>
              <p className="text-slate-600 text-xs">الإيراد</p>
              <p className="font-bold text-slate-900">{formatDZD(salePreview.revenue)}</p>
            </div>
            <div>
              <p className="text-slate-600 text-xs">التكلفة</p>
              <p className="font-bold text-slate-900">{formatDZD(salePreview.cost)}</p>
            </div>
            <div>
              <p className="text-slate-600 text-xs">الربح</p>
              <p
                className={`font-bold ${
                  salePreview.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatDZD(salePreview.profit)}
              </p>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={showEmailModal}
        onClose={() => {
          setShowEmailModal(false);
          setEmailText('');
          setEmailPreview(null);
        }}
        title="استيراد من بريد تأكيد الطلب"
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowEmailModal(false);
                setEmailText('');
                setEmailPreview(null);
              }}
            >
              إلغاء
            </Button>
            <Button variant="secondary" onClick={onAnalyzeEmail} disabled={!emailText.trim()}>
              تحليل النص
            </Button>
            <Button onClick={onUseParsedEmail} disabled={!emailPreview}>
              استعمال في شراء جديد
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            انسخ محتوى بريد تأكيد الطلب (AliExpress / Amazon / eBay / Banggood...)
            وألصقه هنا. التطبيق يحاول استخراج الاسم، السعر، العملة، الكمية،
            المورد، والتاريخ. تقدر تعدل أي حقل قبل الحفظ النهائي.
          </p>
          <Field label="نص البريد">
            <Textarea
              value={emailText}
              onChange={(e) => {
                setEmailText(e.target.value);
                setEmailPreview(null);
              }}
              rows={10}
              placeholder="الصق كامل محتوى البريد هنا..."
            />
          </Field>
          {emailPreview && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm space-y-1">
              <p className="font-medium text-primary-800 mb-2">نتيجة التحليل:</p>
              <div>
                <span className="text-slate-600">اسم القطعة:</span>{' '}
                <span className="font-medium text-slate-900">{emailPreview.item_name}</span>
              </div>
              <div>
                <span className="text-slate-600">الكمية:</span>{' '}
                <span className="font-medium">{emailPreview.quantity}</span>
              </div>
              <div>
                <span className="text-slate-600">العملة:</span>{' '}
                <span className="font-medium">{emailPreview.currency ?? '— غير محدد —'}</span>
              </div>
              <div>
                <span className="text-slate-600">الإجمالي:</span>{' '}
                <span className="font-medium">
                  {emailPreview.raw_total != null
                    ? `${emailPreview.raw_total} ${emailPreview.currency ?? ''}`
                    : '— لم يُكتشف —'}
                </span>
              </div>
              <div>
                <span className="text-slate-600">سعر الوحدة:</span>{' '}
                <span className="font-medium">
                  {emailPreview.unit_cost != null
                    ? `${emailPreview.unit_cost} ${emailPreview.currency ?? ''}`
                    : '— لم يُحسب —'}
                </span>
              </div>
              <div>
                <span className="text-slate-600">الشحن (EUR):</span>{' '}
                <span className="font-medium">
                  {emailPreview.shipping_eur != null ? `${emailPreview.shipping_eur} €` : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-600">المورد:</span>{' '}
                <span className="font-medium">{emailPreview.supplier ?? '—'}</span>
              </div>
              <div>
                <span className="text-slate-600">التاريخ:</span>{' '}
                <span className="font-medium">{emailPreview.purchased_on ?? 'اليوم'}</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                اضغط "استعمال في شراء جديد" لفتح نموذج الشراء مع هذه البيانات قابلة للتعديل.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </Page>
  );
}
