import type {
  Absence,
  BudgetTransaction,
  Category,
  ComputerPurchase,
  ComputerSale,
  CryptoTrade,
  DashboardSummary,
  Debt,
  Holiday,
  Lesson,
  LessonPlan,
  LessonPlanEntry,
  MonthlyData,
  Settings,
  TimetableSlot,
} from '../types';

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> => {
  if (typeof window === 'undefined' || !window.api) {
    return Promise.reject(new Error('Electron API not available'));
  }
  return window.api.invoke(channel, ...args) as Promise<T>;
};

export const api = {
  // Settings
  getSettings: () => invoke<Settings>('settings:get-all'),
  setSetting: (key: string, value: string) => invoke<{ ok: true }>('settings:set', key, value),

  // Categories
  listCategories: () => invoke<Category[]>('categories:list'),
  createCategory: (payload: {
    name: string;
    type: 'income' | 'expense';
    monthly_limit: number | null;
    color: string;
  }) => invoke<{ id: number }>('categories:create', payload),
  updateCategory: (
    id: number,
    payload: { name: string; monthly_limit: number | null; color: string }
  ) => invoke<{ ok: true }>('categories:update', id, payload),
  deleteCategory: (id: number) => invoke<{ ok: true }>('categories:delete', id),

  // Budget
  listBudget: () => invoke<BudgetTransaction[]>('budget:list'),
  createBudget: (payload: {
    category_id: number | null;
    type: 'income' | 'expense';
    amount_dzd: number;
    description: string;
    occurred_on: string;
  }) => invoke<{ id: number }>('budget:create', payload),
  deleteBudget: (id: number) => invoke<{ ok: true }>('budget:delete', id),

  // Debts
  listDebts: () => invoke<Debt[]>('debts:list'),
  createDebt: (payload: {
    person_name: string;
    direction: 'owed_to_me' | 'i_owe';
    amount_dzd: number;
    description: string | null;
    due_date: string | null;
  }) => invoke<{ id: number }>('debts:create', payload),
  toggleDebtSettled: (id: number, settled: boolean) =>
    invoke<{ ok: true }>('debts:toggle-settled', id, settled),
  deleteDebt: (id: number) => invoke<{ ok: true }>('debts:delete', id),

  // Computer purchases
  listComputerPurchases: () => invoke<ComputerPurchase[]>('computer-purchases:list'),
  createComputerPurchase: (payload: {
    item_name: string;
    quantity: number;
    unit_cost_eur: number;
    eur_to_dzd_rate: number;
    shipping_dzd: number;
    supplier: string | null;
    notes: string | null;
    purchased_on: string;
  }) => invoke<{ id: number; total_cost_dzd: number }>('computer-purchases:create', payload),
  deleteComputerPurchase: (id: number) =>
    invoke<{ ok: true }>('computer-purchases:delete', id),

  // Computer sales
  listComputerSales: () => invoke<ComputerSale[]>('computer-sales:list'),
  createComputerSale: (payload: {
    purchase_id: number | null;
    item_name: string;
    quantity: number;
    unit_sale_price_dzd: number;
    unit_cost_dzd: number;
    customer: string | null;
    notes: string | null;
    sold_on: string;
  }) => invoke<{ id: number; profit_dzd: number }>('computer-sales:create', payload),
  deleteComputerSale: (id: number) => invoke<{ ok: true }>('computer-sales:delete', id),

  // Crypto
  listCryptoTrades: () => invoke<CryptoTrade[]>('crypto:list'),
  createCryptoTrade: (payload: {
    trade_type: 'buy' | 'sell';
    coin: string;
    quantity: number;
    price_per_unit_dzd: number;
    counterparty: string | null;
    notes: string | null;
    traded_on: string;
  }) => invoke<{ id: number; total_dzd: number }>('crypto:create', payload),
  deleteCryptoTrade: (id: number) => invoke<{ ok: true }>('crypto:delete', id),

  // Dashboard
  dashboardSummary: () => invoke<DashboardSummary>('dashboard:summary'),
  dashboardMonthly: () => invoke<MonthlyData>('dashboard:monthly'),

  // Save dialog
  showSaveDialog: (options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
    invoke<{ canceled: boolean; filePath?: string }>('app:show-save-dialog', options),

  // ---------- Lesson Planner ----------

  // Lessons
  listLessons: () => invoke<Lesson[]>('lessons:list'),
  listLessonsByLevel: (level: string) => invoke<Lesson[]>('lessons:list-by-level', level),
  createLesson: (payload: {
    level: string;
    field_name: string;
    chapter: string;
    title: string;
    session_type: string;
    duration_sessions: number;
    sort_order: number;
  }) => invoke<{ id: number }>('lessons:create', payload),
  importLessons: (lessons: {
    level: string;
    field_name: string;
    chapter: string;
    title: string;
    session_type: string;
    duration_sessions: number;
    sort_order: number;
  }[]) => invoke<{ ok: true; count: number }>('lessons:import-batch', lessons),
  updateLesson: (id: number, payload: {
    level: string;
    field_name: string;
    chapter: string;
    title: string;
    session_type: string;
    duration_sessions: number;
    sort_order: number;
  }) => invoke<{ ok: true }>('lessons:update', id, payload),
  deleteLesson: (id: number) => invoke<{ ok: true }>('lessons:delete', id),
  deleteLessonsByLevel: (level: string) => invoke<{ ok: true }>('lessons:delete-by-level', level),

  // Timetable
  listTimetable: () => invoke<TimetableSlot[]>('timetable:list'),
  createTimetableSlot: (payload: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    level: string;
    session_type: string;
    room: string | null;
  }) => invoke<{ id: number }>('timetable:create', payload),
  deleteTimetableSlot: (id: number) => invoke<{ ok: true }>('timetable:delete', id),

  // Holidays
  listHolidays: () => invoke<Holiday[]>('holidays:list'),
  createHoliday: (payload: {
    name: string;
    start_date: string;
    end_date: string;
    is_vacation: boolean;
  }) => invoke<{ id: number }>('holidays:create', payload),
  deleteHoliday: (id: number) => invoke<{ ok: true }>('holidays:delete', id),
  seedAlgerianHolidays: (year: number) =>
    invoke<{ ok: true; seeded: boolean }>('holidays:seed-algeria', year),

  // Absences
  listAbsences: () => invoke<Absence[]>('absences:list'),
  createAbsence: (payload: {
    absence_date: string;
    reason: string | null;
    level: string | null;
  }) => invoke<{ id: number }>('absences:create', payload),
  deleteAbsence: (id: number) => invoke<{ ok: true }>('absences:delete', id),

  // Lesson Plans
  listLessonPlans: () => invoke<LessonPlan[]>('lesson-plans:list'),
  getLessonPlanEntries: (planId: number) =>
    invoke<LessonPlanEntry[]>('lesson-plans:get-entries', planId),
  generateLessonPlan: (payload: {
    title: string;
    plan_type: 'weekly' | 'monthly';
    start_date: string;
    end_date: string;
    level: string;
  }) => invoke<{ id: number; entries_count: number }>('lesson-plans:generate', payload),
  updatePlanEntryStatus: (entryId: number, status: string) =>
    invoke<{ ok: true }>('lesson-plans:update-entry-status', entryId, status),
  deleteLessonPlan: (id: number) => invoke<{ ok: true }>('lesson-plans:delete', id),
};
