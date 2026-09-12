/* P31 Single-Flight (缓存优化 §48): collapse concurrent identical
   computations (cache misses on the same key) into one execution.
   In-memory promise map — single instance; Redis lock is a later step. */

const inflight = new Map<string, Promise<unknown>>()

export async function singleFlight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>
  const promise = run().finally(() => {
    inflight.delete(key)
  })
  inflight.set(key, promise)
  return promise
}
