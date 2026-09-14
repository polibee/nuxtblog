<template>
  <PublicPageDetail :page="detail" />
</template>

<script setup lang="ts">
import PublicPageDetail from '~/components/public/PageDetail.vue'
import type { PublicPageDetail as PageDetailData } from '#shared/types/post'

definePageMeta({ layout: 'public', alias: ['/en/pages/:alias'] })

const route = useRoute()
const { localeCode, publicPath } = useLocale()
const { t } = useI18n()

await navigateTo(publicPath(`/` + String(route.params.alias)), { redirectCode: 301 })

const { data: page, error } = await useFetch<PageDetailData>(
  `/api/public/pages/${route.params.alias}`,
  { key: `page-${String(route.params.alias)}-${localeCode.value}`, query: { locale: localeCode.value } }
)

if (error.value || !page.value) {
  throw createError({ statusCode: 404, statusMessage: t('public.page.notFound'), fatal: true })
}

const detail = computed(() => page.value!)

useSeoMeta({
  title: () => page.value?.seoTitle || page.value?.title || '',
  description: () => page.value?.seoDescription || '',
  robots: () => (page.value?.noindex ? 'noindex, nofollow' : undefined)
})
</script>
