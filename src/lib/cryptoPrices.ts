// Free public price feed (no API key) via CoinGecko. Used to populate the
// "price per unit (DZD)" field in the crypto trade form: we fetch the USD
// price and multiply by the user's saved USD-to-DZD rate.

// Symbol → CoinGecko id for the coins we expose by default. Custom coins go
// through `searchCoinGeckoId` which calls the search API once and caches.
const SYMBOL_TO_ID: Record<string, string> = {
  USDT: 'tether',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  SOL: 'solana',
  ETC: 'ethereum-classic',
  AVAX: 'avalanche-2',
  // Common extras the user might enter as custom coins.
  TRX: 'tron',
  MATIC: 'matic-network',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  XRP: 'ripple',
  LTC: 'litecoin',
  DOT: 'polkadot',
  LINK: 'chainlink',
  ATOM: 'cosmos',
  NEAR: 'near',
};

const idCache = new Map<string, string>();

async function searchCoinGeckoId(symbol: string): Promise<string | null> {
  const upper = symbol.trim().toUpperCase();
  if (!upper) return null;
  if (SYMBOL_TO_ID[upper]) return SYMBOL_TO_ID[upper];
  if (idCache.has(upper)) return idCache.get(upper) ?? null;

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(upper)}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { coins?: { id: string; symbol: string }[] };
    const match = data.coins?.find((c) => c.symbol.toUpperCase() === upper);
    const id = match?.id ?? data.coins?.[0]?.id ?? null;
    if (id) idCache.set(upper, id);
    return id;
  } catch {
    return null;
  }
}

// Fetch the current USD price of `symbol` from CoinGecko. EUR/USD are handled
// directly: USD is 1, EUR uses the same forex endpoint via a separate path.
export async function fetchUsdPrice(symbol: string): Promise<number | null> {
  const upper = symbol.trim().toUpperCase();
  if (!upper) return null;
  if (upper === 'USD') return 1;
  if (upper === 'USDT') {
    // CoinGecko returns ~1 with tiny variance; keep precision but bound.
    const t = await fetchKnownCoinUsd('tether');
    return t ?? 1;
  }
  if (upper === 'EUR') {
    // CoinGecko exposes EUR as a vs_currency, not as a coin. Use 1 EUR in
    // USD via the conversion of "1 USD in EUR" inverted.
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=eur'
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { tether?: { eur?: number } };
      const tetherInEur = data.tether?.eur;
      if (!tetherInEur || tetherInEur <= 0) return null;
      // 1 EUR = 1/tetherInEur tether ≈ 1/tetherInEur USD.
      return 1 / tetherInEur;
    } catch {
      return null;
    }
  }
  const id = await searchCoinGeckoId(upper);
  if (!id) return null;
  return fetchKnownCoinUsd(id);
}

async function fetchKnownCoinUsd(id: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, { usd?: number }>;
    return data[id]?.usd ?? null;
  } catch {
    return null;
  }
}
