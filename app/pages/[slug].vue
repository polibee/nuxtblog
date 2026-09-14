<script setup lang="ts">
import PageDetail from '~/components/public/PageDetail.vue'
import type { PublicPageDetail } from '#shared/types/post'

/* Root catch-all: /{alias} resolves a published Page (auto-registration
   for new pages), otherwise 404. /pages/{alias} keeps working too. */

definePageMeta({ layout: 'public' })

const route = useRoute()
const { localeCode } = useLocale()
const { t } = useI18n()
const alias = computed(() => String(route.params.slug))

const { data: page, error } = await useFetch<PublicPageDetail>(
  () => `/api/public/pages/${alias.value}`,
  { key: `page-root-${alias.value}-${localeCode.value}`, query: { locale: localeCode.value } }
)

if (error.value || !page.value) {
  /* Legacy post URLs used the root alias. Keep them working when the
     language switcher preserves that path, while real pages still use the
     root route. */
  const { data: legacyPost } = await useFetch(`/api/public/posts/${alias.value}`, {
    key: `legacy-post-${alias.value}-${localeCode.value}`,
    query: { locale: localeCode.value }
  })
  if (legacyPost.value) {
    await navigateTo(`/posts/${encodeURIComponent(alias.value)}?locale=${encodeURIComponent(localeCode.value)}`, { redirectCode: 301 })
  }
  throw createError({ statusCode: 404, statusMessage: t('public.page.notFound'), fatal: true })
}

const detail = computed(() => page.value!)

useSeoMeta({
  title: () => detail.value.seoTitle || detail.value.title || '',
  description: () => detail.value.seoDescription || '',
  robots: () => (detail.value.noindex ? 'noindex, nofollow' : undefined)
})
</script>

<template>
  <div>
    <PageDetail :page="detail" />
  </div>
</template>
