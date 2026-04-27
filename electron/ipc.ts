import { ipcMain } from 'electron';
import { getDb } from './db.js';

interface SettingsRow {
  key: string;
  value: string;
}

export function registerIpcHandlers() {
  // ---------- Settings ----------
  ipcMain.handle('settings:get-all', () => {
    const rows = getDb().prepare('SELECT key, value FROM settings').all() as SettingsRow[];
    return rows.reduce<Record<string, string>>((acc, r) => {
      acc[r.key] = r.value;
      return acc;
    }, {});
  });

  ipcMain.handle('settings:set', (_e, key: string, value: string) => {
    getDb()
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .run(key, value);
    return { ok: true };
  });

  // ---------- Budget Categories ----------
  ipcMain.handle('categories:list', () =>
    getDb()
      .prepare('SELECT * FROM budget_categories ORDER BY type, name')
      .all()
  );

  ipcMain.handle(
    'categories:create',
    (_e, payload: { name: string; type: 'income' | 'expense'; monthly_limit: number | null; color: string }) => {
      const info = getDb()
        .prepare(
          'INSERT INTO budget_categories (name, type, monthly_limit, color) VALUES (?, ?, ?, ?)'
        )
        .run(payload.name, payload.type, payload.monthly_limit, payload.color);
      return { id: info.lastInsertRowid };
    }
  );

  ipcMain.handle(
    'categories:update',
    (_e, id: number, payload: { name: string; monthly_limit: number | null; color: string }) => {
      getDb()
        .prepare(
          'UPDATE budget_categories SET name = ?, monthly_limit = ?, color = ? WHERE id = ?'
        )
        .run(payload.name, payload.monthly_limit, payload.color, id);
      return { ok: true };
    }
  );

  ipcMain.handle('categories:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM budget_categories WHERE id = ?').run(id);
    return { ok: true };
  });

  // ---------- Budget Transactions ----------
  ipcMain.handle('budget:list', () =>
    getDb()
      .prepare(
        `SELECT t.*, c.name AS category_name, c.color AS category_color
         FROM budget_transactions t
         LEFT JOIN budget_categories c ON c.id = t.category_id
         ORDER BY t.occurred_on DESC, t.id DESC`
      )
      .all()
  );

  ipcMain.handle(
    'budget:create',
    (
      _e,
      payload: {
        category_id: number | null;
        type: 'income' | 'expense';
        amount_dzd: number;
        description: string;
        occurred_on: string;
      }
    ) => {
      const info = getDb()
        .prepare(
          `INSERT INTO budget_transactions (category_id, type, amount_dzd, description, occurred_on)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          payload.category_id,
          payload.type,
          payload.amount_dzd,
          payload.description,
          payload.occurred_on
        );
      return { id: info.lastInsertRowid };
    }
  );

  ipcMain.handle(
    'budget:update',
    (
      _e,
      id: number,
      payload: {
        category_id: number | null;
        type: 'income' | 'expense';
        amount_dzd: number;
        description: string;
        occurred_on: string;
      }
    ) => {
      getDb()
        .prepare(
          `UPDATE budget_transactions
           SET category_id = ?, type = ?, amount_dzd = ?, description = ?, occurred_on = ?
           WHERE id = ?`
        )
        .run(
          payload.category_id,
          payload.type,
          payload.amount_dzd,
          payload.description,
          payload.occurred_on,
          id
        );
      return { ok: true };
    }
  );

  ipcMain.handle('budget:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM budget_transactions WHERE id = ?').run(id);
    return { ok: true };
  });

  // ---------- Debts ----------
  ipcMain.handle('debts:list', () =>
    getDb().prepare('SELECT * FROM debts ORDER BY is_settled, due_date').all()
  );

  ipcMain.handle(
    'debts:create',
    (
      _e,
      payload: {
        person_name: string;
        direction: 'owed_to_me' | 'i_owe';
        amount_dzd: number;
        description: string | null;
        due_date: string | null;
      }
    ) => {
      const info = getDb()
        .prepare(
          `INSERT INTO debts (person_name, direction, amount_dzd, description, due_date)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          payload.person_name,
          payload.direction,
          payload.amount_dzd,
          payload.description,
          payload.due_date
        );
      return { id: info.lastInsertRowid };
    }
  );

  ipcMain.handle(
    'debts:update',
    (
      _e,
      id: number,
      payload: {
        person_name: string;
        direction: 'owed_to_me' | 'i_owe';
        amount_dzd: number;
        description: string | null;
        due_date: string | null;
      }
    ) => {
      getDb()
        .prepare(
          `UPDATE debts
           SET person_name = ?, direction = ?, amount_dzd = ?, description = ?, due_date = ?
           WHERE id = ?`
        )
        .run(
          payload.person_name,
          payload.direction,
          payload.amount_dzd,
          payload.description,
          payload.due_date,
          id
        );
      return { ok: true };
    }
  );

  ipcMain.handle('debts:toggle-settled', (_e, id: number, settled: boolean) => {
    getDb().prepare('UPDATE debts SET is_settled = ? WHERE id = ?').run(settled ? 1 : 0, id);
    return { ok: true };
  });

  ipcMain.handle('debts:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM debts WHERE id = ?').run(id);
    return { ok: true };
  });

  // ---------- Computer Purchases ----------
  ipcMain.handle('computer-purchases:list', () =>
    getDb()
      .prepare('SELECT * FROM computer_purchases ORDER BY purchased_on DESC, id DESC')
      .all()
  );

  ipcMain.handle(
    'computer-purchases:create',
    (
      _e,
      payload: {
        item_name: string;
        quantity: number;
        purchase_currency: 'EUR' | 'USD';
        // Unit cost in the chosen purchase currency (stored in legacy
        // `unit_cost_eur` column for backward compatibility).
        unit_cost: number;
        // DZD rate for the chosen purchase currency (stored in legacy
        // `eur_to_dzd_rate` column for backward compatibility).
        currency_to_dzd_rate: number;
        // Shipping is always priced in EUR by the supplier; convert via the
        // EUR→DZD rate at record time.
        shipping_eur: number;
        shipping_eur_rate: number;
        supplier: string | null;
        notes: string | null;
        purchased_on: string;
      }
    ) => {
      const shipping_dzd = payload.shipping_eur * payload.shipping_eur_rate;
      const total_cost_dzd =
        payload.unit_cost * payload.currency_to_dzd_rate * payload.quantity +
        shipping_dzd;
      const info = getDb()
        .prepare(
          `INSERT INTO computer_purchases (item_name, quantity, unit_cost_eur, eur_to_dzd_rate,
            shipping_dzd, total_cost_dzd, supplier, notes, purchased_on,
            purchase_currency, shipping_eur, shipping_eur_rate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          payload.item_name,
          payload.quantity,
          payload.unit_cost,
          payload.currency_to_dzd_rate,
          shipping_dzd,
          total_cost_dzd,
          payload.supplier,
          payload.notes,
          payload.purchased_on,
          payload.purchase_currency,
          payload.shipping_eur,
          payload.shipping_eur_rate
        );
      return { id: info.lastInsertRowid, total_cost_dzd };
    }
  );

  ipcMain.handle(
    'computer-purchases:update',
    (
      _e,
      id: number,
      payload: {
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
      }
    ) => {
      const shipping_dzd = payload.shipping_eur * payload.shipping_eur_rate;
      const total_cost_dzd =
        payload.unit_cost * payload.currency_to_dzd_rate * payload.quantity +
        shipping_dzd;
      getDb()
        .prepare(
          `UPDATE computer_purchases
           SET item_name = ?, quantity = ?, unit_cost_eur = ?, eur_to_dzd_rate = ?,
               shipping_dzd = ?, total_cost_dzd = ?, supplier = ?, notes = ?, purchased_on = ?,
               purchase_currency = ?, shipping_eur = ?, shipping_eur_rate = ?
           WHERE id = ?`
        )
        .run(
          payload.item_name,
          payload.quantity,
          payload.unit_cost,
          payload.currency_to_dzd_rate,
          shipping_dzd,
          total_cost_dzd,
          payload.supplier,
          payload.notes,
          payload.purchased_on,
          payload.purchase_currency,
          payload.shipping_eur,
          payload.shipping_eur_rate,
          id
        );
      return { ok: true, total_cost_dzd };
    }
  );

  ipcMain.handle('computer-purchases:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM computer_purchases WHERE id = ?').run(id);
    return { ok: true };
  });

  // ---------- Computer Sales ----------
  ipcMain.handle('computer-sales:list', () =>
    getDb()
      .prepare(
        `SELECT s.*, p.item_name AS purchase_item_name
         FROM computer_sales s
         LEFT JOIN computer_purchases p ON p.id = s.purchase_id
         ORDER BY s.sold_on DESC, s.id DESC`
      )
      .all()
  );

  ipcMain.handle(
    'computer-sales:create',
    (
      _e,
      payload: {
        purchase_id: number | null;
        item_name: string;
        quantity: number;
        unit_sale_price_dzd: number;
        unit_cost_dzd: number;
        customer: string | null;
        notes: string | null;
        sold_on: string;
      }
    ) => {
      const total_revenue_dzd = payload.unit_sale_price_dzd * payload.quantity;
      const total_cost_dzd = payload.unit_cost_dzd * payload.quantity;
      const profit_dzd = total_revenue_dzd - total_cost_dzd;
      const info = getDb()
        .prepare(
          `INSERT INTO computer_sales (purchase_id, item_name, quantity, unit_sale_price_dzd,
            unit_cost_dzd, total_revenue_dzd, total_cost_dzd, profit_dzd, customer, notes, sold_on)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          payload.purchase_id,
          payload.item_name,
          payload.quantity,
          payload.unit_sale_price_dzd,
          payload.unit_cost_dzd,
          total_revenue_dzd,
          total_cost_dzd,
          profit_dzd,
          payload.customer,
          payload.notes,
          payload.sold_on
        );
      return { id: info.lastInsertRowid, profit_dzd };
    }
  );

  ipcMain.handle(
    'computer-sales:update',
    (
      _e,
      id: number,
      payload: {
        purchase_id: number | null;
        item_name: string;
        quantity: number;
        unit_sale_price_dzd: number;
        unit_cost_dzd: number;
        customer: string | null;
        notes: string | null;
        sold_on: string;
      }
    ) => {
      const total_revenue_dzd = payload.unit_sale_price_dzd * payload.quantity;
      const total_cost_dzd = payload.unit_cost_dzd * payload.quantity;
      const profit_dzd = total_revenue_dzd - total_cost_dzd;
      getDb()
        .prepare(
          `UPDATE computer_sales
           SET purchase_id = ?, item_name = ?, quantity = ?, unit_sale_price_dzd = ?,
               unit_cost_dzd = ?, total_revenue_dzd = ?, total_cost_dzd = ?, profit_dzd = ?,
               customer = ?, notes = ?, sold_on = ?
           WHERE id = ?`
        )
        .run(
          payload.purchase_id,
          payload.item_name,
          payload.quantity,
          payload.unit_sale_price_dzd,
          payload.unit_cost_dzd,
          total_revenue_dzd,
          total_cost_dzd,
          profit_dzd,
          payload.customer,
          payload.notes,
          payload.sold_on,
          id
        );
      return { ok: true, profit_dzd };
    }
  );

  ipcMain.handle('computer-sales:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM computer_sales WHERE id = ?').run(id);
    return { ok: true };
  });

  // ---------- Crypto Trades ----------
  ipcMain.handle('crypto:list', () =>
    getDb().prepare('SELECT * FROM crypto_trades ORDER BY traded_on DESC, id DESC').all()
  );

  ipcMain.handle(
    'crypto:create',
    (
      _e,
      payload: {
        trade_type: 'buy' | 'sell';
        coin: string;
        quantity: number;
        price_per_unit_dzd: number;
        counterparty: string | null;
        notes: string | null;
        traded_on: string;
      }
    ) => {
      const total_dzd = payload.quantity * payload.price_per_unit_dzd;
      const info = getDb()
        .prepare(
          `INSERT INTO crypto_trades (trade_type, coin, quantity, price_per_unit_dzd,
            total_dzd, counterparty, notes, traded_on)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          payload.trade_type,
          payload.coin,
          payload.quantity,
          payload.price_per_unit_dzd,
          total_dzd,
          payload.counterparty,
          payload.notes,
          payload.traded_on
        );
      return { id: info.lastInsertRowid, total_dzd };
    }
  );

  ipcMain.handle(
    'crypto:update',
    (
      _e,
      id: number,
      payload: {
        trade_type: 'buy' | 'sell';
        coin: string;
        quantity: number;
        price_per_unit_dzd: number;
        counterparty: string | null;
        notes: string | null;
        traded_on: string;
      }
    ) => {
      const total_dzd = payload.quantity * payload.price_per_unit_dzd;
      getDb()
        .prepare(
          `UPDATE crypto_trades
           SET trade_type = ?, coin = ?, quantity = ?, price_per_unit_dzd = ?,
               total_dzd = ?, counterparty = ?, notes = ?, traded_on = ?
           WHERE id = ?`
        )
        .run(
          payload.trade_type,
          payload.coin,
          payload.quantity,
          payload.price_per_unit_dzd,
          total_dzd,
          payload.counterparty,
          payload.notes,
          payload.traded_on,
          id
        );
      return { ok: true, total_dzd };
    }
  );

  ipcMain.handle('crypto:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM crypto_trades WHERE id = ?').run(id);
    return { ok: true };
  });

  // ---------- Dashboard Aggregates ----------
  ipcMain.handle('dashboard:summary', () => {
    const db = getDb();
    const incomeRow = db
      .prepare(
        "SELECT COALESCE(SUM(amount_dzd), 0) as total FROM budget_transactions WHERE type='income'"
      )
      .get() as { total: number };
    const expenseRow = db
      .prepare(
        "SELECT COALESCE(SUM(amount_dzd), 0) as total FROM budget_transactions WHERE type='expense'"
      )
      .get() as { total: number };
    const computerProfitRow = db
      .prepare('SELECT COALESCE(SUM(profit_dzd), 0) as total FROM computer_sales')
      .get() as { total: number };
    const cryptoBuyRow = db
      .prepare(
        "SELECT COALESCE(SUM(total_dzd), 0) as total FROM crypto_trades WHERE trade_type='buy'"
      )
      .get() as { total: number };
    const cryptoSellRow = db
      .prepare(
        "SELECT COALESCE(SUM(total_dzd), 0) as total FROM crypto_trades WHERE trade_type='sell'"
      )
      .get() as { total: number };
    const debtsOwedRow = db
      .prepare(
        "SELECT COALESCE(SUM(amount_dzd), 0) as total FROM debts WHERE direction='owed_to_me' AND is_settled=0"
      )
      .get() as { total: number };
    const debtsIOweRow = db
      .prepare(
        "SELECT COALESCE(SUM(amount_dzd), 0) as total FROM debts WHERE direction='i_owe' AND is_settled=0"
      )
      .get() as { total: number };

    return {
      total_income_dzd: incomeRow.total,
      total_expense_dzd: expenseRow.total,
      net_personal_dzd: incomeRow.total - expenseRow.total,
      computer_trade_profit_dzd: computerProfitRow.total,
      crypto_trade_profit_dzd: cryptoSellRow.total - cryptoBuyRow.total,
      debts_owed_to_me_dzd: debtsOwedRow.total,
      debts_i_owe_dzd: debtsIOweRow.total,
    };
  });

  // ---------- File write helper (Electron renderer has no fs) ----------
  ipcMain.handle('app:write-file', async (_e, filePath: string, contents: string) => {
    const fs = await import('node:fs/promises');
    await fs.writeFile(filePath, contents, 'utf-8');
    return { ok: true };
  });

  // ---------- Backup / Restore ----------
  // Dumps all user-visible tables into a single JSON document so the user
  // can ship it off to Drive / Dropbox / etc. Restore wipes the same set of
  // tables and replays the dump.
  const BACKUP_TABLES = [
    'settings',
    'budget_categories',
    'budget_transactions',
    'debts',
    'computer_purchases',
    'computer_sales',
    'crypto_trades',
  ] as const;

  ipcMain.handle('backup:export', () => {
    const db = getDb();
    const data: Record<string, unknown[]> = {};
    for (const t of BACKUP_TABLES) {
      data[t] = db.prepare(`SELECT * FROM ${t}`).all();
    }
    return {
      app: 'budget-tracker-dz',
      schema_version: 2,
      exported_at: new Date().toISOString(),
      data,
    };
  });

  ipcMain.handle(
    'backup:import',
    (_e, payload: { data: Record<string, Record<string, unknown>[]> }) => {
      if (!payload || typeof payload !== 'object' || !payload.data) {
        throw new Error('نسخة احتياطية غير صالحة');
      }
      const db = getDb();
      const tx = db.transaction(() => {
        for (const t of [...BACKUP_TABLES].reverse()) {
          db.prepare(`DELETE FROM ${t}`).run();
        }
        for (const t of BACKUP_TABLES) {
          const rows = payload.data[t] ?? [];
          if (!rows.length) continue;
          const cols = Object.keys(rows[0]);
          const placeholders = cols.map(() => '?').join(', ');
          const stmt = db.prepare(
            `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${placeholders})`
          );
          for (const r of rows) stmt.run(...cols.map((c) => r[c] ?? null));
        }
      });
      tx();
      return { ok: true, restored_tables: BACKUP_TABLES.length };
    }
  );

  ipcMain.handle('dashboard:monthly', () => {
    const db = getDb();
    const budget = db
      .prepare(
        `SELECT strftime('%Y-%m', occurred_on) AS month,
            SUM(CASE WHEN type='income' THEN amount_dzd ELSE 0 END) AS income,
            SUM(CASE WHEN type='expense' THEN amount_dzd ELSE 0 END) AS expense
         FROM budget_transactions
         GROUP BY month
         ORDER BY month`
      )
      .all() as { month: string; income: number; expense: number }[];

    const computer = db
      .prepare(
        `SELECT strftime('%Y-%m', sold_on) AS month, SUM(profit_dzd) AS profit
         FROM computer_sales GROUP BY month ORDER BY month`
      )
      .all() as { month: string; profit: number }[];

    const crypto = db
      .prepare(
        `SELECT strftime('%Y-%m', traded_on) AS month,
            SUM(CASE WHEN trade_type='sell' THEN total_dzd ELSE -total_dzd END) AS profit
         FROM crypto_trades GROUP BY month ORDER BY month`
      )
      .all() as { month: string; profit: number }[];

    return { budget, computer, crypto };
  });
}
