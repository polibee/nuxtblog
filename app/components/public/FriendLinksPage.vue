<script setup lang="ts">
import { useI18n } from '~/admin/i18n'
import { ExternalLinkIcon, CopyIcon, CheckIcon } from 'lucide-vue-next'
import FriendLinkCard from './FriendLinkCard.vue'

/* Public friend links page (docs/友链.txt §4-6/17/71-73): full-width
   grid, category filter, own-site info with copy buttons, and the
   submission form at the bottom. Data is fetched by the (awaited) page
   and passed in as props — an async child would not SSR. */

const props = defineProps<{
  pageAlias: string
  links: FriendLink[]
  categories: Array<{ id: number, name: string }>
  site: { name: string, url: string, description: string } | null
}>()

interface FriendLink {
  id: number
  name: string
  url: string
  domain: string
  description: string
  logoUrl: string | null
  categoryId: number | null
  featured: boolean
  nofollow: boolean
  openInNewTab: boolean
}

const { t } = useI18n()

const activeCategory = ref<number | null>(null)
const visibleLinks = computed(() =>
  activeCategory.value === null ? props.links : props.links.filter(l => l.categoryId === activeCategory.value)
)
const featuredLinks = computed(() => visibleLinks.value.filter(l => l.featured))
const plainLinks = computed(() => visibleLinks.value.filter(l => !l.featured))

/* §17: copy buttons for our own link info */
const copied = ref('')
async function copy(text: string, tag: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = tag
    setTimeout(() => {
      copied.value = ''
    }, 1500)
  } catch { /* clipboard unavailable */ }
}

/* §14/72/73: submission form at the bottom */
const form = reactive({ siteName: '', siteUrl: '', description: '', logoUrl: '', backlinkUrl: '', contactEmail: '', website: '' })
const submitting = ref(false)
const submitResult = ref<{ ok: boolean, message: string } | null>(null)

async function submit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  submitResult.value = null
  try {
    const res = await $fetch<{ siteStatus: string, backlinkStatus: string }>('/api/friend-links/submissions', {
      method: 'POST',
      body: { ...form }
    })
    const parts: string[] = []
    if (res.siteStatus === 'online') parts.push(t('public.friendlinks.checkSiteOk'))
    if (res.backlinkStatus === 'found') parts.push(t('public.friendlinks.checkBacklinkOk'))
    submitResult.value = {
      ok: true,
      message: parts.length > 0
        ? `${t('public.friendlinks.submitted')} ${parts.join(' · ')}`
        : t('public.friendlinks.submittedNoBacklink')
    }
    Object.assign(form, { siteName: '', siteUrl: '', description: '', logoUrl: '', backlinkUrl: '', contactEmail: '', website: '' })
  } catch (e: unknown) {
    const err = e as Error & { data?: { statusMessage?: string } }
    submitResult.value = { ok: false, message: err.data?.statusMessage || err.message || t('public.friendlinks.submitFailed') }
  } finally {
    submitting.value = false
  }
}

function cardRel(link: FriendLink): string {
  return link.nofollow ? 'noopener noreferrer nofollow' : 'noopener noreferrer'
}

void cardRel
</script>

<template>
  <div class="space-y-10">
    <section class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-3xl font-bold tracking-tight">
            {{ t('public.friendlinks.title') }}
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ t('public.friendlinks.subtitle') }}
          </p>
        </div>
        <UiButton
          variant="outline"
          as="a"
          href="#apply"
        >
          {{ t('public.friendlinks.apply') }}
        </UiButton>
      </div>

      <div class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl border bg-card/70 p-4">
          <p class="text-xs text-muted-foreground">{{ t('public.friendlinks.featured') }}</p>
          <p class="mt-1 text-2xl font-semibold tracking-tight">{{ featuredLinks.length }}</p>
        </div>
        <div class="rounded-xl border bg-card/70 p-4">
          <p class="text-xs text-muted-foreground">{{ t('public.friendlinks.all') }}</p>
          <p class="mt-1 text-2xl font-semibold tracking-tight">{{ visibleLinks.length }}</p>
        </div>
        <div class="rounded-xl border bg-card/70 p-4">
          <p class="text-xs text-muted-foreground">{{ t('public.friendlinks.categories') }}</p>
          <p class="mt-1 text-2xl font-semibold tracking-tight">{{ categories.length }}</p>
        </div>
      </div>

      <!-- §8 category filter -->
      <div
        v-if="categories.length > 0"
        class="flex flex-wrap gap-1.5"
      >
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-xs transition-colors"
          :class="activeCategory === null ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'"
          @click="activeCategory = null"
        >
          {{ t('public.friendlinks.all') }}
        </button>
        <button
          v-for="category in categories"
          :key="category.id"
          type="button"
          class="rounded-full border px-3 py-1 text-xs transition-colors"
          :class="activeCategory === category.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'"
          @click="activeCategory = category.id"
        >
          {{ category.name }}
        </button>
      </div>
    </section>

    <!-- §5/69: featured section first, then the rest -->
    <section
      v-if="featuredLinks.length > 0"
      class="space-y-4"
    >
      <h2 class="text-lg font-semibold">
        {{ t('public.friendlinks.featured') }}
      </h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <FriendLinkCard
          v-for="link in featuredLinks"
          :key="link.id"
          :link="link"
        />
      </div>
    </section>

    <section class="space-y-4">
      <h2
        v-if="featuredLinks.length > 0"
        class="text-lg font-semibold"
      >
        {{ t('public.friendlinks.all') }}
      </h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <FriendLinkCard
          v-for="link in plainLinks"
          :key="link.id"
          :link="link"
        />
      </div>
      <p
        v-if="visibleLinks.length === 0"
        class="text-sm text-muted-foreground"
      >
        {{ t('public.friendlinks.empty') }}
      </p>
    </section>

    <!-- §17: our own link info -->
    <section
      v-if="site"
      class="space-y-3 border-t pt-8"
    >
      <h2 class="text-lg font-semibold">
        {{ t('public.friendlinks.ourInfo') }}
      </h2>
      <div class="max-w-2xl space-y-2 rounded-xl border p-4 text-sm">
        <p>
          <span class="text-muted-foreground">{{ t('public.friendlinks.siteName') }}: </span>
          <span class="font-medium">{{ site.name }}</span>
          <button
            type="button"
            class="ml-1 inline-flex text-muted-foreground hover:text-foreground"
            :title="t('public.friendlinks.copy')"
            @click="copy(site.name, 'name')"
          >
            <CopyIcon
              v-if="copied !== 'name'"
              class="h-3.5 w-3.5"
            />
            <CheckIcon
              v-else
              class="h-3.5 w-3.5 text-primary"
            />
          </button>
        </p>
        <p>
          <span class="text-muted-foreground">{{ t('public.friendlinks.siteUrl') }}: </span>
          <span class="font-mono text-xs">{{ site.url || useRequestURL().origin + '/' }}</span>
          <button
            type="button"
            class="ml-1 inline-flex text-muted-foreground hover:text-foreground"
            @click="copy(site.url || useRequestURL().origin + '/', 'url')"
          >
            <CopyIcon
              v-if="copied !== 'url'"
              class="h-3.5 w-3.5"
            />
            <CheckIcon
              v-else
              class="h-3.5 w-3.5 text-primary"
            />
          </button>
        </p>
        <p
          v-if="site.description"
          class="text-muted-foreground"
        >
          {{ site.description }}
        </p>
        <p class="text-xs text-muted-foreground">
          {{ t('public.friendlinks.ourFriendsPage', { path: props.pageAlias }) }}
        </p>
      </div>
    </section>

    <!-- §16/72: submission form anchored at the bottom -->
    <section
      id="apply"
      class="scroll-mt-24 space-y-4 border-t pt-8"
    >
      <h2 class="text-lg font-semibold">
        {{ t('public.friendlinks.applyTitle') }}
      </h2>
      <ul class="max-w-2xl list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>{{ t('public.friendlinks.req1') }}</li>
        <li>{{ t('public.friendlinks.req2') }}</li>
        <li>{{ t('public.friendlinks.req3') }}</li>
        <li>{{ t('public.friendlinks.req4') }}</li>
      </ul>

      <form
        class="max-w-3xl space-y-5 rounded-2xl border bg-card p-4 shadow-sm sm:p-6"
        @submit.prevent="submit"
      >
        <input
          v-model="form.website"
          type="text"
          tabindex="-1"
          autocomplete="off"
          class="hidden"
          aria-hidden="true"
        >
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('public.friendlinks.formName') }} *</span>
            <input
              v-model="form.siteName"
              required
              maxlength="120"
              autocomplete="organization"
              :placeholder="t('public.friendlinks.formNameHint')"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
          </label>
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('public.friendlinks.formUrl') }} *</span>
            <input
              v-model="form.siteUrl"
              required
              type="url"
              placeholder="https://example.com"
              autocomplete="url"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
          </label>
        </div>
        <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('public.friendlinks.formDescription') }} *</span>
          <textarea
            v-model="form.description"
            required
            rows="4"
            maxlength="500"
            :placeholder="t('public.friendlinks.formDescriptionHint')"
            class="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('public.friendlinks.formLogo') }}</span>
            <input
              v-model="form.logoUrl"
              type="url"
              placeholder="https://…/logo.png"
              autocomplete="url"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
          </label>
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('public.friendlinks.formBacklink') }}</span>
            <input
              v-model="form.backlinkUrl"
              type="url"
              :placeholder="t('public.friendlinks.formBacklinkHint')"
              autocomplete="url"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
          </label>
        </div>
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('public.friendlinks.formEmail') }}</span>
          <input
            v-model="form.contactEmail"
            type="email"
            autocomplete="email"
            :placeholder="t('public.friendlinks.formEmailHint')"
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
        </label>
        <UiButton
          type="submit"
          :disabled="submitting"
        >
          {{ submitting ? t('public.friendlinks.submitting') : t('public.friendlinks.submit') }}
        </UiButton>
        <p
          v-if="submitResult"
          class="text-sm"
          :class="submitResult.ok ? 'text-primary' : 'text-destructive'"
        >
          {{ submitResult.message }}
        </p>
      </form>
    </section>
  </div>
</template>
