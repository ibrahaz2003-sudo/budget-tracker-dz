import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  Cpu,
  Coins,
  GraduationCap,
  Settings as SettingsIcon,
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Budget from './pages/Budget';
import ComputerTrade from './pages/ComputerTrade';
import CryptoTrade from './pages/CryptoTrade';
import LessonPlanner from './pages/LessonPlanner';
import Settings from './pages/Settings';

const navItems = [
  { to: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { to: '/budget', label: 'الميزانية الشخصية', icon: Wallet },
  { to: '/computer', label: 'تجارة قطع الحاسوب', icon: Cpu },
  { to: '/crypto', label: 'العملات الإلكترونية', icon: Coins },
  { to: '/lessons', label: 'مخطط الدروس', icon: GraduationCap },
  { to: '/settings', label: 'الإعدادات', icon: SettingsIcon },
];

export default function App() {
  return (
    <div className="flex h-screen bg-slate-50 text-slate-900" dir="rtl">
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-6 py-6 border-b border-slate-700">
          <h1 className="text-lg font-bold">إدارة الميزانية والتجارة</h1>
          <p className="text-xs text-slate-400 mt-1">بالدينار الجزائري</p>
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
          v0.1.0
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto scroll-area">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/computer" element={<ComputerTrade />} />
          <Route path="/crypto" element={<CryptoTrade />} />
          <Route path="/lessons" element={<LessonPlanner />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
