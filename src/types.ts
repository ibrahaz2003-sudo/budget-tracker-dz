export interface Settings {
  eur_to_dzd_default: string;
  usd_to_dzd_default: string;
  monthly_budget_dzd: string;
}

export interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
  monthly_limit: number | null;
  color: string;
  created_at: string;
}

export interface BudgetTransaction {
  id: number;
  category_id: number | null;
  type: 'income' | 'expense';
  amount_dzd: number;
  description: string;
  occurred_on: string;
  created_at: string;
  category_name: string | null;
  category_color: string | null;
}

export interface Debt {
  id: number;
  person_name: string;
  direction: 'owed_to_me' | 'i_owe';
  amount_dzd: number;
  description: string | null;
  due_date: string | null;
  is_settled: number;
  created_at: string;
}

export interface ComputerPurchase {
  id: number;
  item_name: string;
  quantity: number;
  unit_cost_eur: number;
  eur_to_dzd_rate: number;
  shipping_dzd: number;
  total_cost_dzd: number;
  supplier: string | null;
  notes: string | null;
  purchased_on: string;
  created_at: string;
}

export interface ComputerSale {
  id: number;
  purchase_id: number | null;
  item_name: string;
  quantity: number;
  unit_sale_price_dzd: number;
  unit_cost_dzd: number;
  total_revenue_dzd: number;
  total_cost_dzd: number;
  profit_dzd: number;
  customer: string | null;
  notes: string | null;
  sold_on: string;
  created_at: string;
  purchase_item_name?: string | null;
}

export interface CryptoTrade {
  id: number;
  trade_type: 'buy' | 'sell';
  coin: string;
  quantity: number;
  price_per_unit_dzd: number;
  total_dzd: number;
  counterparty: string | null;
  notes: string | null;
  traded_on: string;
  created_at: string;
}

export interface DashboardSummary {
  total_income_dzd: number;
  total_expense_dzd: number;
  net_personal_dzd: number;
  computer_trade_profit_dzd: number;
  crypto_trade_profit_dzd: number;
  debts_owed_to_me_dzd: number;
  debts_i_owe_dzd: number;
}

export interface MonthlyData {
  budget: { month: string; income: number; expense: number }[];
  computer: { month: string; profit: number }[];
  crypto: { month: string; profit: number }[];
}

declare global {
  interface Window {
    api: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
  }
}
