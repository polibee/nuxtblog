<script setup lang="ts">
import { useField } from 'vee-validate'
import type { FieldNode } from '~/admin/core/types'
import type { TranslationsRecord } from '#shared/types/locale'
import { translationCompletenessByLocale } from '#shared/schemas/locale'
import TranslationStatus from './TranslationStatus.vue'

/* Generic NuxtAdmin extension: edits a translations[locale][field]
   record across locale tabs. The domain service splits the value
   into Entity + Translation tables inside one transaction. */

const props = defineProps<{ node: FieldNode }>()

const { t } = useI18n()
const name = toRef(() => props.node.name)
const { value } = useField<TranslationsRecord | undefined>(name)

interface LocaleTab {
  code: string
  nativeName: string
  isDefault: boolean
}

const localeTabs = ref<LocaleTab[]>([])
const fetched = ref(false)
const activeLocale = ref('')

const subFields = computed<FieldNode[]>(() => props.node.localizedFields ?? [])
const requiredFields = computed(() => subFields.value.map(f => f.name))

const statuses = computed(() =>
  translationCompletenessByLocale(value.value, requiredFields.value)
)

const tabs = computed(() =>
  localeTabs.value.map(l => ({
    value: l.code,
    label: l.isDefault ? `${l.nativeName} · ${t('ext.localized.defaultTag')}` : l.nativeName
  }))
)

function schemaFor(locale: string): FieldNode[] {
  return subFields.value.map(sub => ({
    ...sub,
    name: `${props.node.name}.${locale}.${sub.name}`
  }))
}

onMounted(async () => {
  let tabs_: LocaleTab[] = []
  try {
    const res = await $fetch<{ locales: Array<{
      code: string
      nativeName: string
      isDefault: boolean
      contentEnabled: boolean
    }> }>('/api/public/locales')
    tabs_ = res.locales
      .filter(l => l.contentEnabled)
      .map(l => ({ code: l.code, nativeName: l.nativeName, isDefault: l.isDefault }))
  } catch {
    tabs_ = []
  }
  if (tabs_.length === 0) {
    tabs_ = [{ code: 'zh-CN', nativeName: '简体中文', isDefault: true }]
  }
  localeTabs.value = tabs_
  const initial = tabs_.find(l => l.isDefault) ?? tabs_[0]
  activeLocale.value = initial?.code ?? 'zh-CN'
  fetched.value = true
})
</script>

<template>
  <div class="space-y-1.5">
    <UiTabs
      v-if="fetched && tabs.length > 1"
      :tabs="tabs"
      :model-value="activeLocale"
      @update:model-value="activeLocale = String($event)"
    >
      <template
        v-for="l in localeTabs"
        :key="l.code"
        #[l.code]
      >
        <div class="mb-2">
          <TranslationStatus :status="statuses[l.code] ?? 'missing'" />
        </div>
        <FormSchemaRenderer
          :schema="schemaFor(l.code)"
          in-grid
        />
      </template>
    </UiTabs>

    <template v-else>
      <div
        v-if="fetched"
        class="mb-2"
      >
        <TranslationStatus :status="statuses[activeLocale] ?? 'missing'" />
      </div>
      <FormSchemaRenderer
        v-if="fetched"
        :schema="schemaFor(activeLocale)"
        in-grid
      />
      <p
        v-else
        class="text-sm text-muted-foreground"
      >
        {{ t('common.loading') }}
      </p>
    </template>

    <p
      v-if="node.helpText"
      class="text-xs text-muted-foreground"
    >
      {{ node.helpText }}
    </p>
  </div>
</template>
