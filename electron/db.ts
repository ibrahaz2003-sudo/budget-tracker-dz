import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export function initDatabase(): Database.Database {
  const dbPath = path.join(app.getPath('userData'), 'budget-tracker.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Settings (key-value)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Budget categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS budget_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      monthly_limit REAL,
      color TEXT DEFAULT '#3b82f6',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Budget transactions (income / expense)
  db.exec(`
    CREATE TABLE IF NOT EXISTS budget_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      amount_dzd REAL NOT NULL,
      description TEXT,
      occurred_on TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES budget_categories(id) ON DELETE SET NULL
    );
  `);

  // Debts
  db.exec(`
    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_name TEXT NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('owed_to_me','i_owe')),
      amount_dzd REAL NOT NULL,
      description TEXT,
      due_date TEXT,
      is_settled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Computer parts inventory items
  db.exec(`
    CREATE TABLE IF NOT EXISTS computer_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_cost_eur REAL NOT NULL,
      eur_to_dzd_rate REAL NOT NULL,
      shipping_dzd REAL NOT NULL DEFAULT 0,
      total_cost_dzd REAL NOT NULL,
      supplier TEXT,
      notes TEXT,
      purchased_on TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS computer_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_sale_price_dzd REAL NOT NULL,
      unit_cost_dzd REAL NOT NULL,
      total_revenue_dzd REAL NOT NULL,
      total_cost_dzd REAL NOT NULL,
      profit_dzd REAL NOT NULL,
      customer TEXT,
      notes TEXT,
      sold_on TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (purchase_id) REFERENCES computer_purchases(id) ON DELETE SET NULL
    );
  `);

  // Crypto trades (buy/sell of USDT or other coins)
  db.exec(`
    CREATE TABLE IF NOT EXISTS crypto_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trade_type TEXT NOT NULL CHECK(trade_type IN ('buy','sell')),
      coin TEXT NOT NULL DEFAULT 'USDT',
      quantity REAL NOT NULL,
      price_per_unit_dzd REAL NOT NULL,
      total_dzd REAL NOT NULL,
      counterparty TEXT,
      notes TEXT,
      traded_on TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed default settings if missing
  const seedSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  seedSetting.run('eur_to_dzd_default', '240');
  seedSetting.run('usd_to_dzd_default', '220');
  seedSetting.run('monthly_budget_dzd', '0');

  // Seed default categories
  const catCount = db.prepare('SELECT COUNT(*) as c FROM budget_categories').get() as {
    c: number;
  };
  if (catCount.c === 0) {
    const insertCat = db.prepare(
      'INSERT INTO budget_categories (name, type, color) VALUES (?, ?, ?)'
    );
    insertCat.run('راتب', 'income', '#22c55e');
    insertCat.run('دخل إضافي', 'income', '#10b981');
    insertCat.run('طعام', 'expense', '#ef4444');
    insertCat.run('سكن', 'expense', '#f59e0b');
    insertCat.run('مواصلات', 'expense', '#8b5cf6');
    insertCat.run('فواتير', 'expense', '#06b6d4');
    insertCat.run('ترفيه', 'expense', '#ec4899');
    insertCat.run('أخرى', 'expense', '#64748b');
  }

  return db;
}
