export function getErrorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const value = error as {
    statusCode?: unknown
    status?: unknown
    data?: { statusCode?: unknown }
  }
  for (const candidate of [value.statusCode, value.status, value.data?.statusCode]) {
    const code = typeof candidate === 'number' ? candidate : Number(candidate)
    if (Number.isInteger(code) && code > 0) return code
  }
  return undefined
}

export function isNotFoundError(error: unknown): boolean {
  return getErrorStatusCode(error) === 404
}
