import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  Cpu,
  Coins,
  HandCoins,
  Scale,
  Settings as SettingsIcon,
  Menu,
  X,
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Budget from './pages/Budget';
import ComputerTrade from './pages/ComputerTrade';
import CryptoTrade from './pages/CryptoTrade';
import Debts from './pages/Debts';
import Zakat from './pages/Zakat';
import Settings from './pages/Settings';

const navItems = [
  { to: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { to: '/budget', label: 'الميزانية الشخصية', icon: Wallet },
  { to: '/computer', label: 'تجارة قطع الحاسوب', icon: Cpu },
  { to: '/crypto', label: 'تجارة العملات', icon: Coins },
  { to: '/debts', label: 'الديون', icon: HandCoins },
  { to: '/zakat', label: 'الزكاة', icon: Scale },
  { to: '/settings', label: 'الإعدادات', icon: SettingsIcon },
];

export default function App() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  const currentLabel =
    navItems.find((i) => location.pathname.startsWith(i.to))?.label ?? 'إدارة الميزانية';

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900" dir="rtl">
      {/* Mobile top bar — only visible <md */}
      <header className="md:hidden fixed inset-x-0 top-0 z-30 h-12 bg-slate-900 text-slate-100 flex items-center px-3 gap-3 shadow">
        <button
          type="button"
          onClick={() => setNavOpen((v) => !v)}
          aria-label="فتح القائمة"
          className="p-2 rounded-md hover:bg-slate-800 active:bg-slate-700"
        >
          {navOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <span className="text-sm font-semibold truncate">{currentLabel}</span>
      </header>

      {/* Backdrop for mobile drawer */}
      {navOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`bg-slate-900 text-slate-100 flex flex-col z-40 transition-transform
          fixed md:static inset-y-0 right-0 w-64
          ${navOpen ? 'translate-x-0' : 'translate-x-full'} md:translate-x-0`}
      >
        <div className="px-6 py-6 border-b border-slate-700 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold">إدارة الميزانية والتجارة</h1>
            <p className="text-xs text-slate-400 mt-1">بالدينار الجزائري</p>
          </div>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            aria-label="إغلاق"
            className="md:hidden p-1 rounded hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 scroll-area overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-500">
          v0.4.1
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto scroll-area pt-12 md:pt-0">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/computer" element={<ComputerTrade />} />
          <Route path="/crypto" element={<CryptoTrade />} />
          <Route path="/debts" element={<Debts />} />
          <Route path="/zakat" element={<Zakat />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
