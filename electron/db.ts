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

  // ---------- Lesson Planner ----------

  // Lessons (curriculum items)
  db.exec(`
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      field_name TEXT NOT NULL,
      chapter TEXT NOT NULL,
      title TEXT NOT NULL,
      session_type TEXT NOT NULL DEFAULT 'theory',
      duration_sessions INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Weekly timetable slots
  db.exec(`
    CREATE TABLE IF NOT EXISTS timetable_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      level TEXT NOT NULL,
      session_type TEXT NOT NULL DEFAULT 'theory',
      room TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Holidays
  db.exec(`
    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_vacation INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Absence days
  db.exec(`
    CREATE TABLE IF NOT EXISTS absences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      absence_date TEXT NOT NULL,
      reason TEXT,
      level TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Generated lesson plans
  db.exec(`
    CREATE TABLE IF NOT EXISTS lesson_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      plan_type TEXT NOT NULL DEFAULT 'weekly',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      level TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Plan entries
  db.exec(`
    CREATE TABLE IF NOT EXISTS lesson_plan_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      lesson_id INTEGER NOT NULL,
      scheduled_date TEXT NOT NULL,
      slot_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      FOREIGN KEY (plan_id) REFERENCES lesson_plans(id) ON DELETE CASCADE,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
      FOREIGN KEY (slot_id) REFERENCES timetable_slots(id) ON DELETE SET NULL
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
