// Heuristic parser for order-confirmation emails (AliExpress, Amazon, eBay,
// Banggood, Newegg, generic merchants). Extracts the most likely item name,
// total price, currency, quantity, supplier, and order date from pasted email
// text. All fields are best-effort; the user reviews and edits the prefilled
// purchase modal before saving.

export interface ParsedEmailOrder {
  item_name: string;
  quantity: number;
  unit_cost: number | null;
  currency: 'EUR' | 'USD' | null;
  shipping_eur: number | null;
  supplier: string | null;
  purchased_on: string | null;
  raw_total: number | null;
  notes: string;
}

const SUPPLIER_PATTERNS: { pattern: RegExp; name: string }[] = [
  { pattern: /aliexpress/i, name: 'AliExpress' },
  { pattern: /amazon/i, name: 'Amazon' },
  { pattern: /ebay/i, name: 'eBay' },
  { pattern: /banggood/i, name: 'Banggood' },
  { pattern: /newegg/i, name: 'Newegg' },
  { pattern: /alibaba/i, name: 'Alibaba' },
  { pattern: /gearbest/i, name: 'GearBest' },
  { pattern: /tomtop/i, name: 'TomTop' },
  { pattern: /shein/i, name: 'Shein' },
  { pattern: /ldlc/i, name: 'LDLC' },
  { pattern: /materiel\.net/i, name: 'Materiel.net' },
  { pattern: /cdiscount/i, name: 'Cdiscount' },
  { pattern: /fnac/i, name: 'Fnac' },
  { pattern: /darty/i, name: 'Darty' },
];

// Matches prices like "€1,234.56", "1 234,56 €", "EUR 299.99", "USD 1,299.00",
// "$29.99", "299.99 EUR", "US $299". Captures [fullMatch, amount, currency].
const PRICE_REGEX =
  /(?:(?:€|EUR|eur|€|\$|USD|usd|US\$)\s*([0-9][0-9.,\s]*[0-9]|[0-9]))|(?:([0-9][0-9.,\s]*[0-9]|[0-9])\s*(?:€|EUR|eur|\$|USD|usd))/g;

function normalizeAmount(raw: string): number | null {
  // Handles "1,234.56" (US) and "1.234,56" (EU) and "1 234,56" (FR).
  const trimmed = raw.replace(/\s+/g, '');
  const hasComma = trimmed.includes(',');
  const hasDot = trimmed.includes('.');
  let cleaned: string;
  if (hasComma && hasDot) {
    // Whichever appears last is the decimal separator.
    if (trimmed.lastIndexOf(',') > trimmed.lastIndexOf('.')) {
      cleaned = trimmed.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = trimmed.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Lone comma → decimal separator (EU style), unless it looks like
    // thousands (e.g. "1,234" with 3 digits after) in which case strip.
    const after = trimmed.split(',').pop() ?? '';
    cleaned = after.length === 3 ? trimmed.replace(',', '') : trimmed.replace(',', '.');
  } else {
    cleaned = trimmed;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function detectCurrency(text: string, priceMatch: string): 'EUR' | 'USD' | null {
  const m = priceMatch.toUpperCase();
  if (m.includes('€') || m.includes('EUR')) return 'EUR';
  if (m.includes('$') || m.includes('USD')) return 'USD';
  // Fallback: infer from overall email.
  const counts = {
    EUR: (text.match(/€|EUR\b/gi) ?? []).length,
    USD: (text.match(/\$|USD\b/gi) ?? []).length,
  };
  if (counts.EUR > counts.USD) return 'EUR';
  if (counts.USD > counts.EUR) return 'USD';
  return null;
}

function extractLargestPrice(text: string): {
  amount: number;
  currency: 'EUR' | 'USD' | null;
  rawMatch: string;
} | null {
  const matches: { amount: number; currency: 'EUR' | 'USD' | null; rawMatch: string }[] = [];
  const re = new RegExp(PRICE_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1] ?? m[2];
    if (!raw) continue;
    const n = normalizeAmount(raw);
    if (n == null || n <= 0) continue;
    matches.push({
      amount: n,
      currency: detectCurrency(text, m[0]),
      rawMatch: m[0],
    });
  }
  if (!matches.length) return null;
  // The "total" in an order email is typically the largest price.
  matches.sort((a, b) => b.amount - a.amount);
  return matches[0];
}

function extractTotalPrice(text: string): {
  amount: number;
  currency: 'EUR' | 'USD' | null;
} | null {
  // Look for a line containing "Total", "Order Total", "Grand Total",
  // "Montant total", "المجموع" etc. near a price.
  const lines = text.split(/\r?\n/);
  const totalRe =
    /total|grand\s*total|order\s*total|montant\s*total|المجموع|المبلغ\s*الإجمالي|المبلغ\s*الكلي/i;
  for (const line of lines) {
    if (!totalRe.test(line)) continue;
    const priceRe = new RegExp(PRICE_REGEX.source);
    const m = priceRe.exec(line);
    if (!m) continue;
    const raw = m[1] ?? m[2];
    const n = raw ? normalizeAmount(raw) : null;
    if (n != null && n > 0) {
      return { amount: n, currency: detectCurrency(text, m[0]) };
    }
  }
  const largest = extractLargestPrice(text);
  if (largest) return { amount: largest.amount, currency: largest.currency };
  return null;
}

function extractShipping(text: string): number | null {
  const re =
    /(?:shipping|delivery|expédition|livraison|الشحن|التوصيل)[^\n]{0,60}?(?:€|EUR|eur)\s*([0-9][0-9.,\s]*[0-9]|[0-9])|([0-9][0-9.,\s]*[0-9]|[0-9])\s*(?:€|EUR|eur)[^\n]{0,60}(?:shipping|delivery|expédition|livraison|الشحن|التوصيل)/i;
  const m = re.exec(text);
  if (!m) return null;
  const raw = m[1] ?? m[2];
  if (!raw) return null;
  const n = normalizeAmount(raw);
  return n != null && n > 0 ? n : null;
}

function extractSupplier(text: string): string | null {
  for (const s of SUPPLIER_PATTERNS) {
    if (s.pattern.test(text)) return s.name;
  }
  const fromMatch = /(?:^|\n)\s*(?:From|de|من)\s*:\s*[^<\n]*<?([^@\s>]+@[^>\s]+)/i.exec(
    text
  );
  if (fromMatch) {
    const domain = fromMatch[1].split('@')[1]?.split('.')[0];
    if (domain) return domain.charAt(0).toUpperCase() + domain.slice(1);
  }
  return null;
}

function extractDate(text: string): string | null {
  const patterns: RegExp[] = [
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{2})\/(\d{2})\/(\d{4})/,
    /(\d{2})\.(\d{2})\.(\d{4})/,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (!m) continue;
    if (re === patterns[0]) return `${m[1]}-${m[2]}-${m[3]}`;
    if (re === patterns[1] || re === patterns[2]) {
      return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    if (re === patterns[3]) {
      const months: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      };
      const mm = months[m[1].toLowerCase().slice(0, 3)];
      if (mm) return `${m[3]}-${mm}-${m[2].padStart(2, '0')}`;
    }
  }
  return null;
}

function extractItemName(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  // Subject line: "Subject: ..."
  const subjectLine = lines.find((l) => /^(?:subject|objet|الموضوع)\s*:/i.test(l));
  if (subjectLine) {
    const s = subjectLine.replace(/^[^:]*:\s*/, '').trim();
    // Strip common prefixes.
    const cleaned = s
      .replace(/^(?:re|fwd|fw)\s*:\s*/i, '')
      .replace(/(?:order|commande|طلب)\s*(?:confirmation|confirmed|confirmée)?\s*[#:\-–]?\s*/i, '')
      .replace(/\s*#?\w{6,}\s*$/, '')
      .trim();
    if (cleaned.length > 3 && cleaned.length < 120) return cleaned;
  }
  // Look for a long descriptive line that isn't a price/date/header.
  const candidate = lines.find(
    (l) =>
      l.length > 10 &&
      l.length < 120 &&
      !/^(from|to|date|subject|from|from:)\s*:/i.test(l) &&
      !/\d{4}-\d{2}-\d{2}/.test(l) &&
      !/(total|shipping|price|amount|€|\$|USD|EUR)/i.test(l)
  );
  return candidate ?? 'قطعة من البريد';
}

function extractQuantity(text: string): number {
  const re =
    /(?:quantity|qty|qte|quantité|الكمية)\s*[:-]?\s*(\d+)|\bx\s*(\d+)\b|\((\d+)\s*(?:pcs|pieces|pieces?)/i;
  const m = re.exec(text);
  if (!m) return 1;
  const n = Number(m[1] ?? m[2] ?? m[3]);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function parseOrderEmail(text: string): ParsedEmailOrder {
  const total = extractTotalPrice(text);
  const shipping = extractShipping(text);
  const supplier = extractSupplier(text);
  const purchased_on = extractDate(text);
  const item_name = extractItemName(text);
  const quantity = extractQuantity(text);
  // If we detected a shipping charge inside the total, subtract it so that
  // unit_cost * qty + shipping ~= total.
  const itemsOnly = total && shipping ? total.amount - shipping : total?.amount ?? null;
  const unit_cost =
    itemsOnly != null && quantity > 0 ? +(itemsOnly / quantity).toFixed(2) : null;
  const notes =
    `تم الاستيراد من البريد${total ? ` • الإجمالي: ${total.amount} ${total.currency ?? ''}` : ''}`.trim();
  return {
    item_name,
    quantity,
    unit_cost,
    currency: total?.currency ?? null,
    shipping_eur: shipping,
    supplier,
    purchased_on,
    raw_total: total?.amount ?? null,
    notes,
  };
}
