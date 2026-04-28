// Mobile (Capacitor) data layer. Mirrors electron/ipc.ts handler behaviour on
// top of a local SQLite database. Only used when the app runs inside
// Capacitor — Electron continues to use the existing IPC path.

import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';

const DB_NAME = 'budget_tracker_dz';

let dbPromise: Promise<SQLiteDBConnection> | null = null;

async function openDb(): Promise<SQLiteDBConnection> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const isConn = (await sqlite.isConnection(DB_NAME, false)).result ?? false;
  const db = isConn
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  await db.open();
  await initSchema(db);
  return db;
}

export function getDb(): Promise<SQLiteDBConnection> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

async function initSchema(db: SQLiteDBConnection) {
  // Run DDL identical to electron/db.ts.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budget_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      monthly_limit REAL,
      color TEXT DEFAULT '#3b82f6',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budget_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      amount_dzd REAL NOT NULL,
      description TEXT,
      occurred_on TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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

  // Additive migration for computer_purchases.
  const colsRes = await db.query(`PRAGMA table_info('computer_purchases')`);
  const colNames = new Set((colsRes.values ?? []).map((r: Record<string, unknown>) => String(r.name)));
  if (!colNames.has('purchase_currency')) {
    await db.execute(
      `ALTER TABLE computer_purchases ADD COLUMN purchase_currency TEXT NOT NULL DEFAULT 'EUR'`
    );
  }
  if (!colNames.has('shipping_eur')) {
    await db.execute(`ALTER TABLE computer_purchases ADD COLUMN shipping_eur REAL`);
  }
  if (!colNames.has('shipping_eur_rate')) {
    await db.execute(`ALTER TABLE computer_purchases ADD COLUMN shipping_eur_rate REAL`);
  }
  await db.execute(
    `UPDATE computer_purchases SET shipping_eur_rate = eur_to_dzd_rate WHERE shipping_eur_rate IS NULL`
  );
  await db.execute(
    `UPDATE computer_purchases SET shipping_eur = CASE
       WHEN eur_to_dzd_rate IS NOT NULL AND eur_to_dzd_rate > 0 THEN shipping_dzd / eur_to_dzd_rate
       ELSE 0 END
     WHERE shipping_eur IS NULL`
  );

  // Seed default settings.
  const seed = async (k: string, v: string) => {
    await db.run(
      `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
      [k, v]
    );
  };
  await seed('eur_to_dzd_default', '240');
  await seed('usd_to_dzd_default', '220');
  await seed('monthly_budget_dzd', '0');

  const catCountRes = await db.query(`SELECT COUNT(*) AS c FROM budget_categories`);
  const catCount = Number((catCountRes.values?.[0] as { c: number } | undefined)?.c ?? 0);
  if (catCount === 0) {
    const cats: [string, 'income' | 'expense', string][] = [
      ['راتب', 'income', '#22c55e'],
      ['دخل إضافي', 'income', '#10b981'],
      ['طعام', 'expense', '#ef4444'],
      ['سكن', 'expense', '#f59e0b'],
      ['مواصلات', 'expense', '#8b5cf6'],
      ['فواتير', 'expense', '#06b6d4'],
      ['ترفيه', 'expense', '#ec4899'],
      ['أخرى', 'expense', '#64748b'],
    ];
    for (const [name, type, color] of cats) {
      await db.run(
        `INSERT INTO budget_categories (name, type, color) VALUES (?, ?, ?)`,
        [name, type, color]
      );
    }
  }
}

async function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  const res = await db.query(sql, params as (string | number | null)[]);
  return (res.values ?? []) as T[];
}

async function run(
  sql: string,
  params: unknown[] = []
): Promise<{ lastId: number }> {
  const db = await getDb();
  const res = await db.run(sql, params as (string | number | null)[]);
  return { lastId: res.changes?.lastId ?? 0 };
}

// Dispatcher matching the Electron IPC channel names. Same semantics as
// electron/ipc.ts so the rest of the app can call `api.listBudget()` etc.
// transparently on both desktop and mobile.
export async function invokeMobile<T>(channel: string, ...args: unknown[]): Promise<T> {
  switch (channel) {
    case 'settings:get-all': {
      const rows = await all<{ key: string; value: string }>(
        `SELECT key, value FROM settings`
      );
      return rows.reduce<Record<string, string>>((acc, r) => {
        acc[r.key] = r.value;
        return acc;
      }, {}) as unknown as T;
    }
    case 'settings:set': {
      const [key, value] = args as [string, string];
      await run(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value]
      );
      return { ok: true } as unknown as T;
    }

    case 'categories:list':
      return (await all(`SELECT * FROM budget_categories ORDER BY type, name`)) as unknown as T;
    case 'categories:create': {
      const p = args[0] as {
        name: string;
        type: 'income' | 'expense';
        monthly_limit: number | null;
        color: string;
      };
      const { lastId } = await run(
        `INSERT INTO budget_categories (name, type, monthly_limit, color) VALUES (?, ?, ?, ?)`,
        [p.name, p.type, p.monthly_limit, p.color]
      );
      return { id: lastId } as unknown as T;
    }
    case 'categories:update': {
      const [id, p] = args as [
        number,
        { name: string; monthly_limit: number | null; color: string },
      ];
      await run(
        `UPDATE budget_categories SET name = ?, monthly_limit = ?, color = ? WHERE id = ?`,
        [p.name, p.monthly_limit, p.color, id]
      );
      return { ok: true } as unknown as T;
    }
    case 'categories:delete':
      await run(`DELETE FROM budget_categories WHERE id = ?`, [args[0] as number]);
      return { ok: true } as unknown as T;

    case 'budget:list':
      return (await all(
        `SELECT t.*, c.name AS category_name, c.color AS category_color
         FROM budget_transactions t
         LEFT JOIN budget_categories c ON c.id = t.category_id
         ORDER BY t.occurred_on DESC, t.id DESC`
      )) as unknown as T;
    case 'budget:create': {
      const p = args[0] as {
        category_id: number | null;
        type: 'income' | 'expense';
        amount_dzd: number;
        description: string;
        occurred_on: string;
      };
      const { lastId } = await run(
        `INSERT INTO budget_transactions (category_id, type, amount_dzd, description, occurred_on)
         VALUES (?, ?, ?, ?, ?)`,
        [p.category_id, p.type, p.amount_dzd, p.description, p.occurred_on]
      );
      return { id: lastId } as unknown as T;
    }
    case 'budget:update': {
      const [id, p] = args as [
        number,
        {
          category_id: number | null;
          type: 'income' | 'expense';
          amount_dzd: number;
          description: string;
          occurred_on: string;
        },
      ];
      await run(
        `UPDATE budget_transactions
         SET category_id = ?, type = ?, amount_dzd = ?, description = ?, occurred_on = ?
         WHERE id = ?`,
        [p.category_id, p.type, p.amount_dzd, p.description, p.occurred_on, id]
      );
      return { ok: true } as unknown as T;
    }
    case 'budget:delete':
      await run(`DELETE FROM budget_transactions WHERE id = ?`, [args[0] as number]);
      return { ok: true } as unknown as T;

    case 'debts:list':
      return (await all(
        `SELECT * FROM debts ORDER BY is_settled, due_date`
      )) as unknown as T;
    case 'debts:create': {
      const p = args[0] as {
        person_name: string;
        direction: 'owed_to_me' | 'i_owe';
        amount_dzd: number;
        description: string | null;
        due_date: string | null;
      };
      const { lastId } = await run(
        `INSERT INTO debts (person_name, direction, amount_dzd, description, due_date)
         VALUES (?, ?, ?, ?, ?)`,
        [p.person_name, p.direction, p.amount_dzd, p.description, p.due_date]
      );
      return { id: lastId } as unknown as T;
    }
    case 'debts:update': {
      const [id, p] = args as [
        number,
        {
          person_name: string;
          direction: 'owed_to_me' | 'i_owe';
          amount_dzd: number;
          description: string | null;
          due_date: string | null;
        },
      ];
      await run(
        `UPDATE debts
         SET person_name = ?, direction = ?, amount_dzd = ?, description = ?, due_date = ?
         WHERE id = ?`,
        [p.person_name, p.direction, p.amount_dzd, p.description, p.due_date, id]
      );
      return { ok: true } as unknown as T;
    }
    case 'debts:toggle-settled': {
      const [id, settled] = args as [number, boolean];
      await run(`UPDATE debts SET is_settled = ? WHERE id = ?`, [settled ? 1 : 0, id]);
      return { ok: true } as unknown as T;
    }
    case 'debts:delete':
      await run(`DELETE FROM debts WHERE id = ?`, [args[0] as number]);
      return { ok: true } as unknown as T;

    case 'computer-purchases:list':
      return (await all(
        `SELECT * FROM computer_purchases ORDER BY purchased_on DESC, id DESC`
      )) as unknown as T;
    case 'computer-purchases:create': {
      const p = args[0] as {
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
      };
      const shipping_dzd = p.shipping_eur * p.shipping_eur_rate;
      const total_cost_dzd =
        p.unit_cost * p.currency_to_dzd_rate * p.quantity + shipping_dzd;
      const { lastId } = await run(
        `INSERT INTO computer_purchases (item_name, quantity, unit_cost_eur, eur_to_dzd_rate,
           shipping_dzd, total_cost_dzd, supplier, notes, purchased_on,
           purchase_currency, shipping_eur, shipping_eur_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.item_name,
          p.quantity,
          p.unit_cost,
          p.currency_to_dzd_rate,
          shipping_dzd,
          total_cost_dzd,
          p.supplier,
          p.notes,
          p.purchased_on,
          p.purchase_currency,
          p.shipping_eur,
          p.shipping_eur_rate,
        ]
      );
      return { id: lastId, total_cost_dzd } as unknown as T;
    }
    case 'computer-purchases:update': {
      const [id, p] = args as [
        number,
        {
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
        },
      ];
      const shipping_dzd = p.shipping_eur * p.shipping_eur_rate;
      const total_cost_dzd =
        p.unit_cost * p.currency_to_dzd_rate * p.quantity + shipping_dzd;
      await run(
        `UPDATE computer_purchases
         SET item_name = ?, quantity = ?, unit_cost_eur = ?, eur_to_dzd_rate = ?,
             shipping_dzd = ?, total_cost_dzd = ?, supplier = ?, notes = ?, purchased_on = ?,
             purchase_currency = ?, shipping_eur = ?, shipping_eur_rate = ?
         WHERE id = ?`,
        [
          p.item_name,
          p.quantity,
          p.unit_cost,
          p.currency_to_dzd_rate,
          shipping_dzd,
          total_cost_dzd,
          p.supplier,
          p.notes,
          p.purchased_on,
          p.purchase_currency,
          p.shipping_eur,
          p.shipping_eur_rate,
          id,
        ]
      );
      return { ok: true, total_cost_dzd } as unknown as T;
    }
    case 'computer-purchases:delete':
      await run(`DELETE FROM computer_purchases WHERE id = ?`, [args[0] as number]);
      return { ok: true } as unknown as T;

    case 'computer-sales:list':
      return (await all(
        `SELECT s.*, p.item_name AS purchase_item_name
         FROM computer_sales s
         LEFT JOIN computer_purchases p ON p.id = s.purchase_id
         ORDER BY s.sold_on DESC, s.id DESC`
      )) as unknown as T;
    case 'computer-sales:create': {
      const p = args[0] as {
        purchase_id: number | null;
        item_name: string;
        quantity: number;
        unit_sale_price_dzd: number;
        unit_cost_dzd: number;
        customer: string | null;
        notes: string | null;
        sold_on: string;
      };
      const total_revenue_dzd = p.unit_sale_price_dzd * p.quantity;
      const total_cost_dzd = p.unit_cost_dzd * p.quantity;
      const profit_dzd = total_revenue_dzd - total_cost_dzd;
      const { lastId } = await run(
        `INSERT INTO computer_sales (purchase_id, item_name, quantity, unit_sale_price_dzd,
           unit_cost_dzd, total_revenue_dzd, total_cost_dzd, profit_dzd, customer, notes, sold_on)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.purchase_id,
          p.item_name,
          p.quantity,
          p.unit_sale_price_dzd,
          p.unit_cost_dzd,
          total_revenue_dzd,
          total_cost_dzd,
          profit_dzd,
          p.customer,
          p.notes,
          p.sold_on,
        ]
      );
      return { id: lastId, profit_dzd } as unknown as T;
    }
    case 'computer-sales:update': {
      const [id, p] = args as [
        number,
        {
          purchase_id: number | null;
          item_name: string;
          quantity: number;
          unit_sale_price_dzd: number;
          unit_cost_dzd: number;
          customer: string | null;
          notes: string | null;
          sold_on: string;
        },
      ];
      const total_revenue_dzd = p.unit_sale_price_dzd * p.quantity;
      const total_cost_dzd = p.unit_cost_dzd * p.quantity;
      const profit_dzd = total_revenue_dzd - total_cost_dzd;
      await run(
        `UPDATE computer_sales
         SET purchase_id = ?, item_name = ?, quantity = ?, unit_sale_price_dzd = ?,
             unit_cost_dzd = ?, total_revenue_dzd = ?, total_cost_dzd = ?, profit_dzd = ?,
             customer = ?, notes = ?, sold_on = ?
         WHERE id = ?`,
        [
          p.purchase_id,
          p.item_name,
          p.quantity,
          p.unit_sale_price_dzd,
          p.unit_cost_dzd,
          total_revenue_dzd,
          total_cost_dzd,
          profit_dzd,
          p.customer,
          p.notes,
          p.sold_on,
          id,
        ]
      );
      return { ok: true, profit_dzd } as unknown as T;
    }
    case 'computer-sales:delete':
      await run(`DELETE FROM computer_sales WHERE id = ?`, [args[0] as number]);
      return { ok: true } as unknown as T;

    case 'crypto:list':
      return (await all(
        `SELECT * FROM crypto_trades ORDER BY traded_on DESC, id DESC`
      )) as unknown as T;
    case 'crypto:create': {
      const p = args[0] as {
        trade_type: 'buy' | 'sell';
        coin: string;
        quantity: number;
        price_per_unit_dzd: number;
        counterparty: string | null;
        notes: string | null;
        traded_on: string;
      };
      const total_dzd = p.quantity * p.price_per_unit_dzd;
      const { lastId } = await run(
        `INSERT INTO crypto_trades (trade_type, coin, quantity, price_per_unit_dzd,
           total_dzd, counterparty, notes, traded_on)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.trade_type,
          p.coin,
          p.quantity,
          p.price_per_unit_dzd,
          total_dzd,
          p.counterparty,
          p.notes,
          p.traded_on,
        ]
      );
      return { id: lastId, total_dzd } as unknown as T;
    }
    case 'crypto:update': {
      const [id, p] = args as [
        number,
        {
          trade_type: 'buy' | 'sell';
          coin: string;
          quantity: number;
          price_per_unit_dzd: number;
          counterparty: string | null;
          notes: string | null;
          traded_on: string;
        },
      ];
      const total_dzd = p.quantity * p.price_per_unit_dzd;
      await run(
        `UPDATE crypto_trades
         SET trade_type = ?, coin = ?, quantity = ?, price_per_unit_dzd = ?,
             total_dzd = ?, counterparty = ?, notes = ?, traded_on = ?
         WHERE id = ?`,
        [
          p.trade_type,
          p.coin,
          p.quantity,
          p.price_per_unit_dzd,
          total_dzd,
          p.counterparty,
          p.notes,
          p.traded_on,
          id,
        ]
      );
      return { ok: true, total_dzd } as unknown as T;
    }
    case 'crypto:delete':
      await run(`DELETE FROM crypto_trades WHERE id = ?`, [args[0] as number]);
      return { ok: true } as unknown as T;

    case 'dashboard:summary': {
      const pick = async (sql: string) => {
        const rows = await all<{ total: number }>(sql);
        return rows[0]?.total ?? 0;
      };
      const income = await pick(
        `SELECT COALESCE(SUM(amount_dzd), 0) AS total FROM budget_transactions WHERE type='income'`
      );
      const expense = await pick(
        `SELECT COALESCE(SUM(amount_dzd), 0) AS total FROM budget_transactions WHERE type='expense'`
      );
      const computerProfit = await pick(
        `SELECT COALESCE(SUM(profit_dzd), 0) AS total FROM computer_sales`
      );
      const cryptoBuy = await pick(
        `SELECT COALESCE(SUM(total_dzd), 0) AS total FROM crypto_trades WHERE trade_type='buy'`
      );
      const cryptoSell = await pick(
        `SELECT COALESCE(SUM(total_dzd), 0) AS total FROM crypto_trades WHERE trade_type='sell'`
      );
      const owed = await pick(
        `SELECT COALESCE(SUM(amount_dzd), 0) AS total FROM debts WHERE direction='owed_to_me' AND is_settled=0`
      );
      const iOwe = await pick(
        `SELECT COALESCE(SUM(amount_dzd), 0) AS total FROM debts WHERE direction='i_owe' AND is_settled=0`
      );
      return {
        total_income_dzd: income,
        total_expense_dzd: expense,
        net_personal_dzd: income - expense,
        computer_trade_profit_dzd: computerProfit,
        crypto_trade_profit_dzd: cryptoSell - cryptoBuy,
        debts_owed_to_me_dzd: owed,
        debts_i_owe_dzd: iOwe,
      } as unknown as T;
    }
    case 'dashboard:monthly': {
      const budget = await all(
        `SELECT strftime('%Y-%m', occurred_on) AS month,
                SUM(CASE WHEN type='income' THEN amount_dzd ELSE 0 END) AS income,
                SUM(CASE WHEN type='expense' THEN amount_dzd ELSE 0 END) AS expense
         FROM budget_transactions GROUP BY month ORDER BY month`
      );
      const computer = await all(
        `SELECT strftime('%Y-%m', sold_on) AS month, SUM(profit_dzd) AS profit
         FROM computer_sales GROUP BY month ORDER BY month`
      );
      const crypto = await all(
        `SELECT strftime('%Y-%m', traded_on) AS month,
                SUM(CASE WHEN trade_type='sell' THEN total_dzd ELSE -total_dzd END) AS profit
         FROM crypto_trades GROUP BY month ORDER BY month`
      );
      return { budget, computer, crypto } as unknown as T;
    }

    case 'backup:export': {
      const tables = [
        'settings',
        'budget_categories',
        'budget_transactions',
        'debts',
        'computer_purchases',
        'computer_sales',
        'crypto_trades',
      ];
      const data: Record<string, unknown[]> = {};
      for (const t of tables) {
        data[t] = await all(`SELECT * FROM ${t}`);
      }
      return {
        app: 'budget-tracker-dz',
        schema_version: 2,
        exported_at: new Date().toISOString(),
        data,
      } as unknown as T;
    }
    case 'backup:import': {
      const payload = args[0] as { data: Record<string, Record<string, unknown>[]> };
      if (!payload || typeof payload !== 'object' || !payload.data) {
        throw new Error('نسخة احتياطية غير صالحة');
      }
      const tables = [
        'settings',
        'budget_categories',
        'budget_transactions',
        'debts',
        'computer_purchases',
        'computer_sales',
        'crypto_trades',
      ];
      const d = await getDb();
      await d.execute('BEGIN');
      try {
        for (const t of [...tables].reverse()) {
          await d.run(`DELETE FROM ${t}`, []);
        }
        for (const t of tables) {
          const rows = payload.data[t] ?? [];
          if (!rows.length) continue;
          const cols = Object.keys(rows[0]);
          const placeholders = cols.map(() => '?').join(', ');
          const sql = `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${placeholders})`;
          for (const r of rows) {
            const vals = cols.map((c) => (r[c] ?? null) as string | number | null);
            await d.run(sql, vals);
          }
        }
        await d.execute('COMMIT');
      } catch (e) {
        await d.execute('ROLLBACK');
        throw e;
      }
      return { ok: true, restored_tables: tables.length } as unknown as T;
    }

    case 'app:show-save-dialog':
      // Capacitor has no native save-dialog equivalent — we fall back to the
      // web download path provided by src/lib/export.ts (which already handles
      // the non-Electron case).
      return { canceled: true } as unknown as T;
    case 'app:write-file':
      // File writing on mobile is routed through Capacitor Filesystem directly
      // in the caller; this channel should never fire here.
      throw new Error('app:write-file is Electron-only; use Capacitor Filesystem on mobile');

    default:
      throw new Error(`Unknown mobile IPC channel: ${channel}`);
  }
}
