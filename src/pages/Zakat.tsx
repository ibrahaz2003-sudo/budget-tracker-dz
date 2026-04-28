import { useEffect, useMemo, useState, type ElementType } from 'react';
import {
  Wallet,
  Coins,
  Package,
  ArrowDownCircle,
  ArrowUpCircle,
  Calculator,
  Info,
} from 'lucide-react';
import Page from '../components/Page';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import { Field, Input } from '../components/Input';
import { api } from '../lib/api';
import { formatDZD, formatNumber } from '../lib/format';
import type {
  ComputerPurchase,
  ComputerSale,
  CryptoTrade,
  DashboardSummary,
  Debt,
} from '../types';

// Hanafi nisab uses 85 g of gold. We expose the gram price as a user input
// because gold prices in DZD fluctuate and the user will know their local
// value best. Below the nisab no zakat is due.
const NISAB_GOLD_GRAMS = 85;
const ZAKAT_RATE = 0.025;

export default function Zakat() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [purchases, setPurchases] = useState<ComputerPurchase[]>([]);
  const [sales, setSales] = useState<ComputerSale[]>([]);
  const [crypto, setCrypto] = useState<CryptoTrade[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goldGramPrice, setGoldGramPrice] = useState('');

  const load = async () => {
    const [s, p, sa, c, d] = await Promise.all([
      api.dashboardSummary(),
      api.listComputerPurchases(),
      api.listComputerSales(),
      api.listCryptoTrades(),
      api.listDebts(),
    ]);
    setSummary(s);
    setPurchases(p);
    setSales(sa);
    setCrypto(c);
    setDebts(d);
  };

  useEffect(() => {
    load();
  }, []);

  // Inventory (computer parts) still held at cost.
  // purchases_total - sales_cost = cost of unsold stock (approximation when
  // sales are linked to purchases, which preserves FIFO-by-purchase).
  const inventoryCost = useMemo(() => {
    const purchasesTotal = purchases.reduce((a, p) => a + p.total_cost_dzd, 0);
    const salesCost = sales.reduce((a, s) => a + s.total_cost_dzd, 0);
    return Math.max(0, purchasesTotal - salesCost);
  }, [purchases, sales]);

  // Realized cash flow from computer trading = sale revenue − purchase cost.
  // Combined with inventoryCost this captures the full asset picture:
  //   (sales_rev − purchases) + (purchases − sales_cost) = sales_rev − sales_cost
  // i.e. inventory-at-cost + realized gross profit. Without this term we were
  // ignoring the profit cash sitting "in the pocket" after each sale.
  const computerTradingCash = useMemo(() => {
    const salesRevenue = sales.reduce((a, s) => a + s.total_revenue_dzd, 0);
    const purchasesTotal = purchases.reduce((a, p) => a + p.total_cost_dzd, 0);
    return salesRevenue - purchasesTotal;
  }, [purchases, sales]);

  // Realized cash flow from crypto / fiat trading = total sell DZD − total buy
  // DZD. Same reasoning as computerTradingCash.
  const cryptoTradingCash = useMemo(() => {
    const buys = crypto
      .filter((t) => t.trade_type === 'buy')
      .reduce((a, t) => a + t.total_dzd, 0);
    const sells = crypto
      .filter((t) => t.trade_type === 'sell')
      .reduce((a, t) => a + t.total_dzd, 0);
    return sells - buys;
  }, [crypto]);

  // Crypto/fiat holdings valued at weighted average buy price (conservative,
  // since using last buy or market price would require manual input).
  const cryptoHoldings = useMemo(() => {
    const h: Record<string, { qty: number; avgBuyPrice: number }> = {};
    const sorted = [...crypto].sort((a, b) => {
      const d = a.traded_on.localeCompare(b.traded_on);
      return d !== 0 ? d : a.id - b.id;
    });
    for (const t of sorted) {
      if (!h[t.coin]) h[t.coin] = { qty: 0, avgBuyPrice: 0 };
      const entry = h[t.coin];
      if (t.trade_type === 'buy') {
        const newQty = entry.qty + t.quantity;
        const newCost =
          entry.qty * entry.avgBuyPrice + t.quantity * t.price_per_unit_dzd;
        entry.avgBuyPrice = newQty > 0 ? newCost / newQty : 0;
        entry.qty = newQty;
      } else {
        entry.qty -= t.quantity;
      }
    }
    const rows = Object.entries(h)
      .filter(([, v]) => v.qty > 0)
      .map(([coin, v]) => ({
        coin,
        qty: v.qty,
        avgBuyPrice: v.avgBuyPrice,
        valueDzd: v.qty * v.avgBuyPrice,
      }));
    const totalDzd = rows.reduce((a, r) => a + r.valueDzd, 0);
    return { rows, totalDzd };
  }, [crypto]);

  const debtsSummary = useMemo(() => {
    const open = debts.filter((d) => !d.is_settled);
    const owedToMe = open
      .filter((d) => d.direction === 'owed_to_me')
      .reduce((a, d) => a + d.amount_dzd, 0);
    const iOwe = open
      .filter((d) => d.direction === 'i_owe')
      .reduce((a, d) => a + d.amount_dzd, 0);
    return { owedToMe, iOwe };
  }, [debts]);

  // Cash from net personal budget (income − expense). This can go negative;
  // we clamp to 0 for zakat purposes since zakat is on held wealth, not
  // overdrafts.
  const cashDzd = summary ? Math.max(0, summary.net_personal_dzd) : 0;

  // Capital = personal cash + realized trading cash (computer + crypto)
  //           + inventory at cost + crypto/fiat holdings
  //           + debts owed to me (collectible) − debts I owe.
  // Trading cash flow can be negative (still buying, not yet selling) — we
  // keep it as-is instead of clamping, because that accurately represents the
  // outflow from personal cash. Clamping would double-count.
  // Scholars differ on whether debts-owed-to-me are included immediately or
  // only when received; we include them so the user sees the upper bound and
  // can adjust manually.
  const totalCapital =
    cashDzd +
    computerTradingCash +
    cryptoTradingCash +
    inventoryCost +
    cryptoHoldings.totalDzd +
    debtsSummary.owedToMe -
    debtsSummary.iOwe;

  const nisabDzd = (() => {
    const p = Number(goldGramPrice) || 0;
    return p > 0 ? p * NISAB_GOLD_GRAMS : 0;
  })();

  const aboveNisab = nisabDzd > 0 && totalCapital >= nisabDzd;
  const zakatDue = aboveNisab ? totalCapital * ZAKAT_RATE : 0;

  return (
    <Page
      title="الزكاة"
      description="عرض رأس المال الإجمالي مفصّلاً لحساب الزكاة يدوياً (النسبة: 2.5٪)"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="نقد (صافي الميزانية)"
          value={formatDZD(cashDzd)}
          icon={Wallet}
          tone="default"
        />
        <StatCard
          label="مخزون قطع الحاسوب (بسعر التكلفة)"
          value={formatDZD(inventoryCost)}
          icon={Package}
          tone="default"
        />
        <StatCard
          label="حيازة العملات (بمتوسط الشراء)"
          value={formatDZD(cryptoHoldings.totalDzd)}
          icon={Coins}
          tone="default"
        />
        <StatCard
          label="صافي الديون (لّلو − عليّ)"
          value={formatDZD(debtsSummary.owedToMe - debtsSummary.iOwe)}
          icon={Calculator}
          tone={debtsSummary.owedToMe - debtsSummary.iOwe >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <Card title="رأس المال الإجمالي">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 text-sm">
            <Row label="نقد (صافي دخل − مصاريف)" value={cashDzd} />
            <Row
              label="نقد تجارة قطع الحاسوب (مبيعات − مشتريات)"
              value={computerTradingCash}
              negative={computerTradingCash < 0}
            />
            <Row
              label="نقد تداول العملات (بيع − شراء)"
              value={cryptoTradingCash}
              negative={cryptoTradingCash < 0}
            />
            <Row label="مخزون قطع الحاسوب بالتكلفة" value={inventoryCost} />
            <Row
              label="حيازة العملات بالمتوسط الموزون"
              value={cryptoHoldings.totalDzd}
            />
            <Row
              label="مستحقات لي (لّلو) غير مسددة"
              value={debtsSummary.owedToMe}
              icon={ArrowDownCircle}
            />
            <Row
              label="مستحقات عليّ غير مسددة"
              value={-debtsSummary.iOwe}
              icon={ArrowUpCircle}
              negative
            />
            <div className="border-t border-slate-200 pt-2 mt-2 flex items-center justify-between">
              <span className="font-bold text-slate-900">المجموع</span>
              <span className="text-xl font-bold text-primary-700">
                {formatDZD(totalCapital)}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-2 text-xs text-slate-600">
              <Info size={14} className="mt-0.5 shrink-0" />
              <p>
                النصاب حسب مذهب الجمهور = قيمة {NISAB_GOLD_GRAMS} غ من الذهب. أدخل سعر
                الغرام اليوم لمعرفة هل رأس المال بلغ النصاب.
              </p>
            </div>
            <Field label="سعر غرام الذهب (DZD)" hint="اختياري — للإرشاد فقط">
              <Input
                type="number"
                step="0.01"
                value={goldGramPrice}
                onChange={(e) => setGoldGramPrice(e.target.value)}
                placeholder="مثال: 24000"
              />
            </Field>
            {nisabDzd > 0 && (
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">النصاب</span>
                  <span className="font-medium">{formatDZD(nisabDzd)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">رأس المال</span>
                  <span className="font-medium">{formatDZD(totalCapital)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="text-slate-700 font-medium">
                    الزكاة المستحقة (2.5٪)
                  </span>
                  <span
                    className={`font-bold ${aboveNisab ? 'text-emerald-700' : 'text-slate-400'}`}
                  >
                    {aboveNisab ? formatDZD(zakatDue) : 'دون النصاب'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {cryptoHoldings.rows.length > 0 && (
        <Card title="تفصيل حيازة العملات">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right border-b border-slate-200 text-slate-600">
                  <th className="py-2 px-3 font-medium">العملة</th>
                  <th className="py-2 px-3 font-medium">الكمية</th>
                  <th className="py-2 px-3 font-medium">متوسط الشراء</th>
                  <th className="py-2 px-3 font-medium">القيمة (DZD)</th>
                </tr>
              </thead>
              <tbody>
                {cryptoHoldings.rows.map((r) => (
                  <tr key={r.coin} className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium">{r.coin}</td>
                    <td className="py-2 px-3">{formatNumber(r.qty, 4)}</td>
                    <td className="py-2 px-3 text-slate-600">
                      {formatDZD(r.avgBuyPrice)}
                    </td>
                    <td className="py-2 px-3 font-semibold">
                      {formatDZD(r.valueDzd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="ملاحظات فقهية">
        <ul className="text-sm text-slate-600 space-y-1 list-disc pr-5">
          <li>
            المخزون التجاري (قطع الحاسوب) تُقوَّم يوم حساب الزكاة بسعر السوق —
            التطبيق يعرضها بسعر التكلفة؛ عدّل يدوياً إذا ارتفعت/انخفضت الأسعار.
          </li>
          <li>
            حيازة العملات معروضة بمتوسط الشراء الموزون؛ للدقة عدّلها إلى سعر السوق
            يوم الحول.
          </li>
          <li>
            الديون المعترف بها من الطرف الآخر داخلة في الزكاة حال القدرة على
            استردادها؛ تُزكَّى السنة الحالية فقط عند القبض عند بعض العلماء.
          </li>
          <li>
            الزكاة لا تجب إلا على ما بلغ النصاب وحال عليه الحول (قمري). الحساب
            أعلاه إرشادي — استشر عالم ثقة عند الشك.
          </li>
        </ul>
      </Card>
    </Page>
  );
}

function Row({
  label,
  value,
  icon: Icon,
  negative,
}: {
  label: string;
  value: number;
  icon?: ElementType;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600 flex items-center gap-2">
        {Icon && <Icon size={14} className="text-slate-400" />}
        {label}
      </span>
      <span
        className={`font-medium ${
          negative || value < 0 ? 'text-rose-700' : 'text-slate-900'
        }`}
      >
        {formatDZD(value)}
      </span>
    </div>
  );
}
