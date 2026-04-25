import type {
  BudgetTransaction,
  Category,
  ComputerPurchase,
  ComputerSale,
  CryptoTrade,
  DashboardSummary,
  Debt,
  MonthlyData,
  Settings,
} from '../types';

// On Electron the renderer talks to the main process via window.api (set up by
// preload.ts). Inside Capacitor (Android) we instead route to a local SQLite
// adapter that mirrors the same channel contract — see src/data/mobileDb.ts.
// Detection is lazy so the mobile bundle isn't pulled into the Electron build
// when window.api is present.
const isCapacitor = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (window.api) return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  return !!cap?.isNativePlatform?.();
};

const invoke = async <T>(channel: string, ...args: unknown[]): Promise<T> => {
  if (typeof window !== 'undefined' && window.api) {
    return window.api.invoke(channel, ...args) as Promise<T>;
  }
  if (isCapacitor()) {
    const { invokeMobile } = await import('../data/mobileDb');
    return invokeMobile<T>(channel, ...args);
  }
  return Promise.reject(new Error('No data backend available (need Electron or Capacitor)'));
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
    purchase_currency: 'EUR' | 'USD';
    unit_cost: number;
    currency_to_dzd_rate: number;
    shipping_eur: number;
    shipping_eur_rate: number;
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
};
