<script setup lang="ts">
import { safePublicHttpUrl, type AuthorSocial } from '#shared/schemas/author-card'

const props = defineProps<{
  name: string
  profileUrl?: string
  avatar?: { url: string, alt: string } | null
  avatarStyle?: 'circle' | 'rounded'
  socials?: AuthorSocial[]
}>()

const { t } = useI18n()

const safeProfileUrl = computed(() => {
  const value = props.profileUrl?.trim() ?? ''
  return value.startsWith('/') && !value.startsWith('//') && !/[\\\u0000-\u001f]/.test(value) ? value : ''
})

const avatar = computed(() => {
  if (!props.avatar) return null
  const url = safePublicHttpUrl(props.avatar.url)
  return url ? { ...props.avatar, url } : null
})

const socials = computed(() => (props.socials ?? [])
  .map((social) => {
    const url = safePublicHttpUrl(social.url)
    return url ? { ...social, url } : null
  })
  .filter((social): social is AuthorSocial => social !== null)
  .slice(0, 5))

const avatarClass = computed(() => [
  props.avatarStyle === 'rounded' ? 'rounded-xl' : 'rounded-full',
  'h-14 w-14'
])
</script>

<template>
  <div class="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm sm:p-6">
    <div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex min-w-0 items-center gap-3.5">
        <img
          v-if="avatar"
          :src="avatar.url"
          :alt="avatar.alt || name"
          loading="lazy"
          class="shrink-0 object-cover ring-2 ring-background"
          :class="avatarClass"
        >
        <div class="min-w-0 space-y-2">
          <p class="truncate text-lg font-semibold leading-tight">
            {{ name }}
          </p>
          <div
            v-if="socials.length"
            class="flex flex-wrap items-center gap-1"
          >
            <a
              v-for="social in socials"
              :key="social.platform + social.url"
              :href="social.url"
              :target="social.url.startsWith('http') ? '_blank' : undefined"
              :rel="social.url.startsWith('http') ? 'nofollow noopener noreferrer' : undefined"
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :aria-label="social.label || social.platform"
              :title="social.label || social.platform"
            >
              <component
                :is="socialIcon(social.platform)"
                class="h-4 w-4"
              />
            </a>
          </div>
        </div>
      </div>

      <NuxtLink
        v-if="safeProfileUrl"
        :to="safeProfileUrl"
        class="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border px-3.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {{ t('public.profile.viewProfile') }}
      </NuxtLink>
    </div>
  </div>
</template>
