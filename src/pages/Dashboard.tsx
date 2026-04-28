import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Cpu,
  Coins,
  Wallet,
  HandCoins,
  AlertTriangle,
  Package,
  Boxes,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Page from '../components/Page';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import { api } from '../lib/api';
import { formatDZD, formatNumber, monthLabel } from '../lib/format';
import type {
  ComputerPurchase,
  ComputerSale,
  CryptoTrade,
  DashboardSummary,
  MonthlyData,
  Settings,
} from '../types';

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [purchases, setPurchases] = useState<ComputerPurchase[]>([]);
  const [sales, setSales] = useState<ComputerSale[]>([]);
  const [crypto, setCrypto] = useState<CryptoTrade[]>([]);

  const load = async () => {
    const [s, m, set, p, sa, c] = await Promise.all([
      api.dashboardSummary(),
      api.dashboardMonthly(),
      api.getSettings(),
      api.listComputerPurchases(),
      api.listComputerSales(),
      api.listCryptoTrades(),
    ]);
    setSummary(s);
    setMonthly(m);
    setSettings(set);
    setPurchases(p);
    setSales(sa);
    setCrypto(c);
  };

  useEffect(() => {
    load();
  }, []);

  const inventoryCost = useMemo(() => {
    const purchasesTotal = purchases.reduce((a, p) => a + p.total_cost_dzd, 0);
    const salesCost = sales.reduce((a, s) => a + s.total_cost_dzd, 0);
    return Math.max(0, purchasesTotal - salesCost);
  }, [purchases, sales]);

  const inventoryItems = useMemo(() => {
    // Net qty held per part name = qty bought − qty sold for the same name.
    const bought: Record<string, number> = {};
    const soldByName: Record<string, number> = {};
    for (const p of purchases) {
      bought[p.item_name] = (bought[p.item_name] ?? 0) + p.quantity;
    }
    for (const s of sales) {
      soldByName[s.item_name] = (soldByName[s.item_name] ?? 0) + s.quantity;
    }
    return Object.entries(bought)
      .map(([name, qty]) => ({
        name,
        remaining: qty - (soldByName[name] ?? 0),
      }))
      .filter((r) => r.remaining > 0);
  }, [purchases, sales]);

  const cryptoHoldings = useMemo(() => {
    const h: Record<string, { qty: number; avgBuyPrice: number }> = {};
    const sorted = [...crypto].sort((a, b) => {
      const d = a.traded_on.localeCompare(b.traded_on);
      return d !== 0 ? d : a.id - b.id;
    });
    for (const t of sorted) {
      if (!h[t.coin]) h[t.coin] = { qty: 0, avgBuyPrice: 0 };
      const e = h[t.coin];
      if (t.trade_type === 'buy') {
        const newQty = e.qty + t.quantity;
        const newCost = e.qty * e.avgBuyPrice + t.quantity * t.price_per_unit_dzd;
        e.avgBuyPrice = newQty > 0 ? newCost / newQty : 0;
        e.qty = newQty;
      } else {
        e.qty -= t.quantity;
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

  if (!summary || !monthly || !settings) {
    return (
      <Page title="الرئيسية">
        <p className="text-slate-500">جارٍ التحميل...</p>
      </Page>
    );
  }

  const monthlyBudget = Number(settings.monthly_budget_dzd) || 0;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthExpense =
    monthly.budget.find((m) => m.month === currentMonth)?.expense ?? 0;
  const overBudget = monthlyBudget > 0 && currentMonthExpense > monthlyBudget;

  // Merge monthly data into single chart-friendly array
  const months = Array.from(
    new Set([
      ...monthly.budget.map((b) => b.month),
      ...monthly.computer.map((c) => c.month),
      ...monthly.crypto.map((c) => c.month),
    ])
  ).sort();

  const chartData = months.map((m) => {
    const b = monthly.budget.find((x) => x.month === m);
    const comp = monthly.computer.find((x) => x.month === m);
    const cry = monthly.crypto.find((x) => x.month === m);
    return {
      month: monthLabel(m),
      دخل: b?.income ?? 0,
      مصاريف: b?.expense ?? 0,
      ربح_حاسوب: comp?.profit ?? 0,
      ربح_عملات: cry?.profit ?? 0,
    };
  });

  const totalNet =
    summary.net_personal_dzd +
    summary.computer_trade_profit_dzd +
    summary.crypto_trade_profit_dzd;

  return (
    <Page title="الرئيسية" description="نظرة عامة على الميزانية والتجارة">
      {overBudget && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold text-amber-800">تنبيه تجاوز الميزانية</p>
            <p className="text-sm text-amber-700 mt-1">
              مصاريف هذا الشهر {formatDZD(currentMonthExpense)} تجاوزت الحد الشهري المحدد{' '}
              {formatDZD(monthlyBudget)}.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="الدخل الإجمالي"
          value={formatDZD(summary.total_income_dzd)}
          icon={TrendingUp}
          tone="positive"
        />
        <StatCard
          label="المصاريف الإجمالية"
          value={formatDZD(summary.total_expense_dzd)}
          icon={TrendingDown}
          tone="negative"
        />
        <StatCard
          label="صافي الميزانية الشخصية"
          value={formatDZD(summary.net_personal_dzd)}
          icon={Wallet}
          tone={summary.net_personal_dzd >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="الصافي الكلي (مع التجارة)"
          value={formatDZD(totalNet)}
          icon={TrendingUp}
          tone={totalNet >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="ربح تجارة قطع الحاسوب"
          value={formatDZD(summary.computer_trade_profit_dzd)}
          icon={Cpu}
          tone={summary.computer_trade_profit_dzd >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="ربح تجارة العملات (USDT)"
          value={formatDZD(summary.crypto_trade_profit_dzd)}
          icon={Coins}
          tone={summary.crypto_trade_profit_dzd >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="مستحقات لي (لّلو)"
          value={formatDZD(summary.debts_owed_to_me_dzd)}
          icon={HandCoins}
          tone="default"
        />
        <StatCard
          label="مستحقات عليّ"
          value={formatDZD(summary.debts_i_owe_dzd)}
          icon={HandCoins}
          tone="warning"
        />
      </div>

      {(cryptoHoldings.rows.length > 0 || inventoryItems.length > 0) && (
        <Card title="الحيازات الحالية (تُحتسب ضمن رأس المال في الزكاة)">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="قيمة مخزون قطع الحاسوب (بالتكلفة)"
              value={formatDZD(inventoryCost)}
              icon={Package}
              tone="default"
            />
            <StatCard
              label="قيمة العملات المحتفظ بها (بمتوسط الشراء)"
              value={formatDZD(cryptoHoldings.totalDzd)}
              icon={Boxes}
              tone="default"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {cryptoHoldings.rows.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-800 mb-2 text-sm">
                  العملات (EUR / USD / كريبتو) غير المباعة
                </h3>
                <div className="space-y-1">
                  {cryptoHoldings.rows.map((r) => (
                    <div
                      key={r.coin}
                      className="flex items-center justify-between border border-slate-200 rounded px-3 py-2 text-sm"
                    >
                      <span className="font-bold text-slate-800">{r.coin}</span>
                      <div className="text-left">
                        <div className="text-slate-700">
                          {formatNumber(r.qty)} وحدة
                        </div>
                        <div className="text-xs text-slate-500">
                          ≈ {formatDZD(r.valueDzd)} (متوسط {formatDZD(r.avgBuyPrice)}/وحدة)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {inventoryItems.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-800 mb-2 text-sm">
                  مخزون قطع الحاسوب غير المباعة
                </h3>
                <div className="space-y-1">
                  {inventoryItems.map((r) => (
                    <div
                      key={r.name}
                      className="flex items-center justify-between border border-slate-200 rounded px-3 py-2 text-sm"
                    >
                      <span className="text-slate-800">{r.name}</span>
                      <span className="font-bold text-slate-700">
                        {formatNumber(r.remaining)} قطعة
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="الدخل والمصاريف الشهرية">
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              لا توجد بيانات بعد. أضف عمليات لتظهر الرسوم البيانية.
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="دخل" fill="#22c55e" />
                  <Bar dataKey="مصاريف" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="أرباح التجارة الشهرية">
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              لا توجد بيانات بعد.
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="ربح_حاسوب" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="ربح_عملات" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
