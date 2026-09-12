import { bumpDomains, type AiDomain } from './domain-versions'

/* P31 invalidation entrypoint (缓存优化 §31/32): content write services
   call bumpAiDomains with the domains they touch. Never throws — cache
   staleness must not break writes; the tool-cache TTL caps the window. */

export async function bumpAiDomains(domains: AiDomain[]): Promise<void> {
  await bumpDomains(domains)
}
