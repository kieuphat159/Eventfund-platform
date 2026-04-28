let cached: { ts: number; data: { usd: number; vnd: number } } | null = null;

export async function fetchEthPrices(): Promise<{ usd: number; vnd: number }> {
  const now = Date.now();
  if (cached && now - cached.ts < 5 * 60 * 1000) {
    return cached.data;
  }

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd,vnd",
    );
    if (!res.ok) throw new Error("Failed to fetch exchange rates");
    const json = await res.json();
    const price = json?.ethereum || {};
    const usd = Number(price.usd || 0);
    const vnd = Number(price.vnd || 0);
    cached = { ts: now, data: { usd, vnd } };
    return { usd, vnd };
  } catch (err) {
    // fallback to previous cache if available
    if (cached) return cached.data;
    return { usd: 0, vnd: 0 };
  }
}
