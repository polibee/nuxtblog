const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'CLP'])

/** display price from minor units; mirrors the server-side money rules */
export function formatMoney(amountMinor: number, currency: string): string {
  const decimals = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2
  return `${currency.toUpperCase()} ${(amountMinor / 10 ** decimals).toFixed(decimals)}`
}
