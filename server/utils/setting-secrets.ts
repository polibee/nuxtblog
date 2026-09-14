export function maskSettingValue(value: string | number | boolean, type: string): string | number | boolean {
  if (type !== 'secret') return value
  const raw = String(value)
  return raw ? `••••${raw.slice(-4)}` : ''
}
