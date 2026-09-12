import type { AdPayload } from '../types/advertising'

/* Shared client-side resolution store (impl doc §4): results are keyed
   by `${path}:${slot}` so every <AdSlot> on one page shares a single
   resolve-batch request; membership status never enters SSR HTML. */

const pending = new Map<string, Promise<void>>()
const registeredSlots = new Map<string, Set<string>>()
const results = reactive(new Map<string, AdPayload | null>())
const resolvedMap = reactive(new Map<string, boolean>())

export function useAdvertising(slotName: string, options?: { disabled?: boolean }) {
  const route = useRoute()
  const pathKey = computed(() => route.path)

  const result = computed<AdPayload | null>(() =>
    results.get(`${pathKey.value}:${slotName}`) ?? null
  )
  const resolved = computed(() => resolvedMap.get(`${pathKey.value}:${slotName}`) ?? false)

  function resolveBatch(): Promise<void> {
    if (pending.has(pathKey.value)) return pending.get(pathKey.value)!
    const slots = [...(registeredSlots.get(pathKey.value) ?? [])]
    const promise = (async () => {
      if (slots.length === 0) return
      try {
        const res = await $fetch<{ results: Record<string, AdPayload | null> }>(
          '/api/advertising/resolve-batch',
          { method: 'POST', body: { slots, path: pathKey.value } }
        )
        for (const [slot, payload] of Object.entries(res.results)) {
          results.set(`${pathKey.value}:${slot}`, payload)
          resolvedMap.set(`${pathKey.value}:${slot}`, true)
        }
      } catch {
        for (const slot of slots) {
          resolvedMap.set(`${pathKey.value}:${slot}`, true)
        }
      } finally {
        pending.delete(pathKey.value)
      }
    })()
    pending.set(pathKey.value, promise)
    return promise
  }

  if (import.meta.client) {
    onMounted(() => {
      if (options?.disabled) {
        results.set(`${pathKey.value}:${slotName}`, { kind: 'NO_AD', reason: 'page_excluded' })
        resolvedMap.set(`${pathKey.value}:${slotName}`, true)
        return
      }
      const set = registeredSlots.get(pathKey.value) ?? new Set<string>()
      set.add(slotName)
      registeredSlots.set(pathKey.value, set)
      // batch after the current tick so sibling AdSlots join the same request
      setTimeout(() => void resolveBatch(), 0)
    })
  }

  return { result, resolved }
}
