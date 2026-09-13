<template>
  <PageDetailView :page="detail" />
</template>

<script setup lang="ts">
import PageDetailView from '~/components/public/PageDetail.vue'
import type { PublicPageDetail } from '#shared/types/post'

definePageMeta({ layout: 'public' })

const route = useRoute()
const { localeCode } = useLocale()
const { t } = useI18n()
const alias = computed(() => String(route.params.slug))

const { data: page, error } = await useFetch<PublicPageDetail>(
  () => `/api/public/pages/${alias.value}`,
  { key: `page-locale-root-${alias.value}-${localeCode.value}`, query: { locale: localeCode.value } }
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
