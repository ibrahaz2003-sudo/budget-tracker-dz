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
        unit_cost_eur: number;
        eur_to_dzd_rate: number;
        shipping_dzd: number;
        supplier: string | null;
        notes: string | null;
        purchased_on: string;
      }
    ) => {
      const total_cost_dzd =
        payload.unit_cost_eur * payload.eur_to_dzd_rate * payload.quantity +
        payload.shipping_dzd;
      const info = getDb()
        .prepare(
          `INSERT INTO computer_purchases (item_name, quantity, unit_cost_eur, eur_to_dzd_rate,
            shipping_dzd, total_cost_dzd, supplier, notes, purchased_on)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          payload.item_name,
          payload.quantity,
          payload.unit_cost_eur,
          payload.eur_to_dzd_rate,
          payload.shipping_dzd,
          total_cost_dzd,
          payload.supplier,
          payload.notes,
          payload.purchased_on
        );
      return { id: info.lastInsertRowid, total_cost_dzd };
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

  ipcMain.handle('crypto:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM crypto_trades WHERE id = ?').run(id);
    return { ok: true };
  });

  // ---------- Lessons ----------
  ipcMain.handle('lessons:list', () =>
    getDb()
      .prepare('SELECT * FROM lessons ORDER BY level, field_name, sort_order, id')
      .all()
  );

  ipcMain.handle('lessons:list-by-level', (_e, level: string) =>
    getDb()
      .prepare('SELECT * FROM lessons WHERE level = ? ORDER BY field_name, sort_order, id')
      .all(level)
  );

  ipcMain.handle(
    'lessons:create',
    (
      _e,
      payload: {
        level: string;
        field_name: string;
        chapter: string;
        title: string;
        session_type: string;
        duration_sessions: number;
        sort_order: number;
      }
    ) => {
      const info = getDb()
        .prepare(
          `INSERT INTO lessons (level, field_name, chapter, title, session_type, duration_sessions, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          payload.level,
          payload.field_name,
          payload.chapter,
          payload.title,
          payload.session_type,
          payload.duration_sessions,
          payload.sort_order
        );
      return { id: info.lastInsertRowid };
    }
  );

  ipcMain.handle(
    'lessons:import-batch',
    (
      _e,
      lessons: {
        level: string;
        field_name: string;
        chapter: string;
        title: string;
        session_type: string;
        duration_sessions: number;
        sort_order: number;
      }[]
    ) => {
      const db = getDb();
      const insert = db.prepare(
        `INSERT INTO lessons (level, field_name, chapter, title, session_type, duration_sessions, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      const insertMany = db.transaction(
        (
          items: {
            level: string;
            field_name: string;
            chapter: string;
            title: string;
            session_type: string;
            duration_sessions: number;
            sort_order: number;
          }[]
        ) => {
          for (const item of items) {
            insert.run(
              item.level,
              item.field_name,
              item.chapter,
              item.title,
              item.session_type,
              item.duration_sessions,
              item.sort_order
            );
          }
        }
      );
      insertMany(lessons);
      return { ok: true, count: lessons.length };
    }
  );

  ipcMain.handle(
    'lessons:update',
    (
      _e,
      id: number,
      payload: {
        level: string;
        field_name: string;
        chapter: string;
        title: string;
        session_type: string;
        duration_sessions: number;
        sort_order: number;
      }
    ) => {
      getDb()
        .prepare(
          `UPDATE lessons SET level=?, field_name=?, chapter=?, title=?, session_type=?, duration_sessions=?, sort_order=?
           WHERE id=?`
        )
        .run(
          payload.level,
          payload.field_name,
          payload.chapter,
          payload.title,
          payload.session_type,
          payload.duration_sessions,
          payload.sort_order,
          id
        );
      return { ok: true };
    }
  );

  ipcMain.handle('lessons:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM lessons WHERE id = ?').run(id);
    return { ok: true };
  });

  ipcMain.handle('lessons:delete-by-level', (_e, level: string) => {
    getDb().prepare('DELETE FROM lessons WHERE level = ?').run(level);
    return { ok: true };
  });

  // ---------- Timetable Slots ----------
  ipcMain.handle('timetable:list', () =>
    getDb()
      .prepare('SELECT * FROM timetable_slots ORDER BY day_of_week, start_time')
      .all()
  );

  ipcMain.handle(
    'timetable:create',
    (
      _e,
      payload: {
        day_of_week: number;
        start_time: string;
        end_time: string;
        level: string;
        session_type: string;
        room: string | null;
      }
    ) => {
      const info = getDb()
        .prepare(
          `INSERT INTO timetable_slots (day_of_week, start_time, end_time, level, session_type, room)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          payload.day_of_week,
          payload.start_time,
          payload.end_time,
          payload.level,
          payload.session_type,
          payload.room
        );
      return { id: info.lastInsertRowid };
    }
  );

  ipcMain.handle('timetable:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM timetable_slots WHERE id = ?').run(id);
    return { ok: true };
  });

  // ---------- Holidays ----------
  ipcMain.handle('holidays:list', () =>
    getDb().prepare('SELECT * FROM holidays ORDER BY start_date').all()
  );

  ipcMain.handle(
    'holidays:create',
    (
      _e,
      payload: {
        name: string;
        start_date: string;
        end_date: string;
        is_vacation: boolean;
      }
    ) => {
      const info = getDb()
        .prepare(
          `INSERT INTO holidays (name, start_date, end_date, is_vacation)
           VALUES (?, ?, ?, ?)`
        )
        .run(payload.name, payload.start_date, payload.end_date, payload.is_vacation ? 1 : 0);
      return { id: info.lastInsertRowid };
    }
  );

  ipcMain.handle('holidays:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM holidays WHERE id = ?').run(id);
    return { ok: true };
  });

  ipcMain.handle(
    'holidays:seed-algeria',
    (_e, year: number) => {
      const db = getDb();
      const existing = db
        .prepare('SELECT COUNT(*) as c FROM holidays WHERE start_date LIKE ?')
        .get(`${year}%`) as { c: number };
      if (existing.c > 0) return { ok: true, seeded: false };

      const holidays = [
        { name: 'رأس السنة الميلادية', start: `${year}-01-01`, end: `${year}-01-01`, vac: 0 },
        { name: 'يناير (رأس السنة الأمازيغية)', start: `${year}-01-12`, end: `${year}-01-12`, vac: 0 },
        { name: 'عيد العمال', start: `${year}-05-01`, end: `${year}-05-01`, vac: 0 },
        { name: 'عيد الاستقلال', start: `${year}-07-05`, end: `${year}-07-05`, vac: 0 },
        { name: 'ثورة أول نوفمبر', start: `${year}-11-01`, end: `${year}-11-01`, vac: 0 },
        { name: 'عطلة الشتاء', start: `${year}-12-19`, end: `${year + 1}-01-02`, vac: 1 },
        { name: 'عطلة الربيع', start: `${year}-03-13`, end: `${year}-03-27`, vac: 1 },
        { name: 'عيد الفطر (تقريبي)', start: `${year}-03-30`, end: `${year}-04-01`, vac: 0 },
        { name: 'عيد الأضحى (تقريبي)', start: `${year}-06-07`, end: `${year}-06-09`, vac: 0 },
        { name: 'رأس السنة الهجرية (تقريبي)', start: `${year}-06-27`, end: `${year}-06-27`, vac: 0 },
        { name: 'المولد النبوي الشريف (تقريبي)', start: `${year}-09-05`, end: `${year}-09-05`, vac: 0 },
      ];

      const insert = db.prepare(
        'INSERT INTO holidays (name, start_date, end_date, is_vacation) VALUES (?, ?, ?, ?)'
      );
      const insertAll = db.transaction(() => {
        for (const h of holidays) {
          insert.run(h.name, h.start, h.end, h.vac);
        }
      });
      insertAll();
      return { ok: true, seeded: true };
    }
  );

  // ---------- Absences ----------
  ipcMain.handle('absences:list', () =>
    getDb().prepare('SELECT * FROM absences ORDER BY absence_date DESC').all()
  );

  ipcMain.handle(
    'absences:create',
    (
      _e,
      payload: {
        absence_date: string;
        reason: string | null;
        level: string | null;
      }
    ) => {
      const info = getDb()
        .prepare(
          'INSERT INTO absences (absence_date, reason, level) VALUES (?, ?, ?)'
        )
        .run(payload.absence_date, payload.reason, payload.level);
      return { id: info.lastInsertRowid };
    }
  );

  ipcMain.handle('absences:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM absences WHERE id = ?').run(id);
    return { ok: true };
  });

  // ---------- Lesson Plans ----------
  ipcMain.handle('lesson-plans:list', () =>
    getDb().prepare('SELECT * FROM lesson_plans ORDER BY created_at DESC').all()
  );

  ipcMain.handle('lesson-plans:get-entries', (_e, planId: number) =>
    getDb()
      .prepare(
        `SELECT e.*, l.title AS lesson_title, l.field_name, l.chapter, l.session_type AS lesson_session_type,
                l.level AS lesson_level,
                t.day_of_week, t.start_time, t.end_time, t.room
         FROM lesson_plan_entries e
         JOIN lessons l ON l.id = e.lesson_id
         LEFT JOIN timetable_slots t ON t.id = e.slot_id
         ORDER BY e.scheduled_date, t.start_time`
      )
      .all(planId)
  );

  ipcMain.handle(
    'lesson-plans:generate',
    (
      _e,
      payload: {
        title: string;
        plan_type: 'weekly' | 'monthly';
        start_date: string;
        end_date: string;
        level: string;
      }
    ) => {
      const db = getDb();

      const lessons = db
        .prepare('SELECT * FROM lessons WHERE level = ? ORDER BY field_name, sort_order, id')
        .all(payload.level) as {
        id: number;
        duration_sessions: number;
        session_type: string;
      }[];

      const slots = db
        .prepare(
          'SELECT * FROM timetable_slots WHERE level = ? ORDER BY day_of_week, start_time'
        )
        .all(payload.level) as {
        id: number;
        day_of_week: number;
        session_type: string;
      }[];

      const holidays = db
        .prepare(
          'SELECT * FROM holidays WHERE start_date <= ? AND end_date >= ?'
        )
        .all(payload.end_date, payload.start_date) as {
        start_date: string;
        end_date: string;
      }[];

      const absences = db
        .prepare(
          'SELECT absence_date FROM absences WHERE absence_date BETWEEN ? AND ? AND (level IS NULL OR level = ?)'
        )
        .all(payload.start_date, payload.end_date, payload.level) as {
        absence_date: string;
      }[];

      const holidayDates = new Set<string>();
      for (const h of holidays) {
        const start = new Date(h.start_date);
        const end = new Date(h.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          holidayDates.add(d.toISOString().slice(0, 10));
        }
      }
      for (const a of absences) {
        holidayDates.add(a.absence_date);
      }

      const availableDates: { date: string; slot: typeof slots[0] }[] = [];
      const startD = new Date(payload.start_date);
      const endD = new Date(payload.end_date);

      for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().slice(0, 10);
        if (holidayDates.has(dateStr)) continue;
        const dayOfWeek = d.getDay();
        for (const slot of slots) {
          if (slot.day_of_week === dayOfWeek) {
            availableDates.push({ date: dateStr, slot });
          }
        }
      }

      const info = db
        .prepare(
          `INSERT INTO lesson_plans (title, plan_type, start_date, end_date, level)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(payload.title, payload.plan_type, payload.start_date, payload.end_date, payload.level);

      const planId = info.lastInsertRowid;
      const insertEntry = db.prepare(
        `INSERT INTO lesson_plan_entries (plan_id, lesson_id, scheduled_date, slot_id, status)
         VALUES (?, ?, ?, ?, 'pending')`
      );

      let slotIndex = 0;
      const insertAll = db.transaction(() => {
        for (const lesson of lessons) {
          for (let s = 0; s < lesson.duration_sessions; s++) {
            if (slotIndex >= availableDates.length) break;
            const avail = availableDates[slotIndex];
            insertEntry.run(planId, lesson.id, avail.date, avail.slot.id);
            slotIndex++;
          }
          if (slotIndex >= availableDates.length) break;
        }
      });
      insertAll();

      return { id: planId, entries_count: slotIndex };
    }
  );

  ipcMain.handle(
    'lesson-plans:update-entry-status',
    (_e, entryId: number, status: string) => {
      getDb()
        .prepare('UPDATE lesson_plan_entries SET status = ? WHERE id = ?')
        .run(status, entryId);
      return { ok: true };
    }
  );

  ipcMain.handle('lesson-plans:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM lesson_plan_entries WHERE plan_id = ?').run(id);
    getDb().prepare('DELETE FROM lesson_plans WHERE id = ?').run(id);
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
