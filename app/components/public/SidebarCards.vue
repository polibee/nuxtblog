<script setup lang="ts">
import AdSlot from '~/modules/advertising/components/AdSlot.vue'
import PublicArticleToc from '~/components/public/ArticleToc.vue'
import PublicAuthorCard from '~/components/public/AuthorCardView.vue'
import { extractToc } from '~/utils/blog'
import type { PublicSidebarCard } from '#shared/schemas/sidebar-card'
const { localeCode, publicPath } = useLocale()

/* Renders admin-managed sidebar cards for the current locale.
   Card HTML is whitelisted by sanitize-html on the server; fetch
   failures render nothing so the sidebar never blocks the page. */

const { data, status } = await useFetch<{ locale: string, cards: PublicSidebarCard[] }>(
  '/api/public/sidebar',
  {
    key: computed(() => `public-sidebar-${localeCode.value}`),
    query: computed(() => ({ locale: localeCode.value })),
    lazy: true
  }
)

import { NuxtLink } from '#components'

const cards = computed(() => data.value?.cards ?? [])

/* article_toc cards render only when the current page registered a TOC */
const tocItems = useState<ReturnType<typeof extractToc>['toc'] | null>('article-toc', () => null)
</script>

<template>
  <div class="space-y-4">
    <template v-if="status === 'pending'">
      <UiSkeleton class="h-32 w-full rounded-xl" />
      <UiSkeleton class="h-48 w-full rounded-xl" />
    </template>

    <UiCard
      v-for="card in cards"
      :key="card.id"
      class="overflow-hidden"
      :class="card.type === 'ad_slot' ? 'p-0' : 'p-5'"
    >
      <template v-if="card.type === 'article_toc' && tocItems?.length">
        <PublicArticleToc :items="tocItems" />
      </template>

      <template v-else-if="card.type === 'author' && card.author">
        <PublicAuthorCard
          :name="card.author.name"
          :headline="card.author.headline"
          :bio="card.author.bio"
          :avatar="card.author.avatar"
          :avatar-style="card.author.avatarStyle"
          :layout="card.author.layout"
          :socials="card.author.socials"
          :cta="card.author.cta"
          :profile-url="card.author.profileUrl"
        />
      </template>

      <template v-else-if="card.type === 'author' && !card.author">
        <span class="hidden" />
      </template>

      <template v-else-if="card.type === 'ad_slot' && card.content.trim()">
        <AdSlot :name="card.content.trim()" />
      </template>

      <template v-else-if="card.type !== 'article_toc' && card.type !== 'ad_slot'">
        <h3 class="mb-2 text-sm font-semibold tracking-wide">
          <NuxtLink
            v-if="card.type === 'link' && card.linkUrl"
            :to="card.linkUrl"
            class="hover:text-primary"
          >
            {{ card.title }}
          </NuxtLink>
          <template v-else>
            {{ card.title }}
          </template>
        </h3>

        <template v-if="card.type === 'image_link'">
          <component
            :is="card.linkUrl ? NuxtLink : 'div'"
            :to="card.linkUrl || undefined"
            class="block"
          >
            <img
              v-if="card.imageUrl"
              :src="card.imageUrl"
              :alt="card.title"
              class="mb-2 aspect-4/3 w-full rounded-md border object-cover"
            >
            <!-- eslint-disable-next-line vue/no-v-html -- whitelisted via server-side sanitize-html -->
            <div
              class="prose prose-sm max-w-none text-sm leading-relaxed text-muted-foreground"
              v-html="card.content"
            />
          </component>
        </template>

        <template v-else-if="card.type === 'js_ad'">
          <!-- eslint-disable-next-line vue/no-v-html -- admin-managed ad code, intentional -->
          <div v-html="card.content" />
        </template>

        <template v-else-if="card.type === 'latest_posts' && card.items">
          <ul class="space-y-2 text-sm">
            <li
              v-for="item in card.items"
              :key="item.alias"
            >
              <NuxtLink
                :to="publicPath(`/posts/${item.alias}`)"
                class="text-muted-foreground hover:text-primary hover:underline"
              >
                {{ item.title }}
              </NuxtLink>
            </li>
          </ul>
        </template>

        <template v-else-if="card.type === 'membership_plans' && card.plans">
          <ul class="space-y-2 text-sm">
            <li
              v-for="plan in card.plans"
              :key="plan.id"
              class="flex items-center justify-between gap-2"
            >
              <span class="truncate">{{ plan.name }}</span>
              <NuxtLink
                :to="`/membership?plan=${plan.productAlias}&currency=${plan.currency}`"
                class="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary hover:bg-primary/20"
              >
                {{ formatMoney(plan.priceMinor, plan.currency) }}
              </NuxtLink>
            </li>
          </ul>
        </template>

        <template v-else>
          <!-- eslint-disable-next-line vue/no-v-html -- whitelisted via server-side sanitize-html -->
          <div
            class="prose prose-sm max-w-none text-sm leading-relaxed text-muted-foreground"
            v-html="card.content"
          />
        </template>
      </template>
    </UiCard>
  </div>
</template>
