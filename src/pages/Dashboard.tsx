import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Cpu,
  Coins,
  Wallet,
  HandCoins,
  AlertTriangle,
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
import { formatDZD, monthLabel } from '../lib/format';
import type { DashboardSummary, MonthlyData, Settings } from '../types';

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  const load = async () => {
    const [s, m, set] = await Promise.all([
      api.dashboardSummary(),
      api.dashboardMonthly(),
      api.getSettings(),
    ]);
    setSummary(s);
    setMonthly(m);
    setSettings(set);
  };

  useEffect(() => {
    load();
  }, []);

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
