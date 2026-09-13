<script setup lang="ts">
import { localizedPath } from '#shared/utils/locale-navigation'

const route = useRoute()
const { localeCode, setLocale } = useLocale()
const { t } = useI18n()
type PublicLocale = { code: string, nativeName: string, urlPrefix: string | null, isDefault: boolean, enabled: boolean, contentEnabled: boolean }
const registry = useState<PublicLocale[]>('public-locales', () => [])
const fallbackLocales = computed<PublicLocale[]>(() => [
  { code: 'zh-CN', nativeName: t('common.language.zhName'), urlPrefix: '', isDefault: true, enabled: true, contentEnabled: true },
  { code: 'en', nativeName: t('common.language.enName'), urlPrefix: 'en', isDefault: false, enabled: true, contentEnabled: true }
])
const locales = computed(() => {
  const active = registry.value.filter(l => l.enabled && l.contentEnabled)
  return active.length > 0 ? active : fallbackLocales.value
})

function shortLabel(code: string): string {
  if (code.toLowerCase().startsWith('zh')) return t('common.language.zhShort')
  return code.split('-')[0]?.slice(0, 2).toUpperCase() || code
}

onMounted(async () => {
  if (registry.value.length > 0) return
  const result = await $fetch<{ locales: PublicLocale[] }>('/api/public/locales').catch(() => ({ locales: [] }))
  registry.value = result.locales
})

async function switchTo(target: typeof locales.value[number]): Promise<void> {
  if (target.code === localeCode.value) return
  const defaultCode = locales.value.find(item => item.isDefault)?.code ?? 'zh-CN'
  setLocale(target.code, target.urlPrefix ?? '')
  const cleanPath = localizedPath(route.fullPath, {
    code: target.code,
    urlPrefix: target.urlPrefix ?? ''
  }, defaultCode)
  await navigateTo(cleanPath)
}

async function switchByCode(code: string): Promise<void> {
  const target = locales.value.find(item => item.code === code)
  if (target) await switchTo(target)
}
</script>

<template>
  <div
    v-if="locales.length > 1"
    class="relative inline-flex items-center"
  >
    <select
      :value="localeCode"
      :aria-label="t('common.language.label')"
      :title="t('common.language.label')"
      class="h-8 min-w-12 appearance-none rounded-full border border-border/70 bg-background px-3 pr-7 text-center text-xs font-medium text-foreground shadow-none outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring"
      @change="switchByCode(($event.target as HTMLSelectElement).value)"
    >
      <option
        v-for="item in locales"
        :key="item.code"
        :value="item.code"
      >
        {{ shortLabel(item.code) }}
      </option>
    </select>
    <span
      aria-hidden="true"
      class="pointer-events-none absolute right-2 text-[10px] text-muted-foreground"
    >
      ⌄
    </span>
    <!-- Keep the full native language names available to assistive technology. -->
    <span class="sr-only">
      {{ locales.map(item => `${item.nativeName} (${item.code})`).join(', ') }}
    </span>
  </div>
</template>
