<script setup lang="ts">
import type { AuthorSocial, ResolvedAuthorCard } from '#shared/schemas/author-card'

/* Sidebar Author Card (docs Author Card 设计方案): restrained profile
   card — centered or compact layout, max 5 social icons, light CTA. */

const props = defineProps<{
  name: string
  headline?: string
  bio?: string
  avatar?: { url: string, alt: string } | null
  avatarStyle?: 'circle' | 'rounded'
  layout?: 'centered' | 'compact'
  socials?: AuthorSocial[]
  cta?: { label: string, url: string, external: boolean } | null
  profileUrl?: string
}>()

const { t } = useI18n()

const socials = computed(() => (props.socials ?? []).slice(0, 5))

const compact = computed(() => props.layout === 'compact')

const safeProfileUrl = computed(() => {
  const value = props.profileUrl?.trim() ?? ''
  return value.startsWith('/') && !value.startsWith('//') ? value : ''
})

const avatarClass = computed(() => [
  props.avatarStyle === 'rounded' ? 'rounded-xl' : 'rounded-full',
  compact.value ? 'h-12 w-12' : 'h-20 w-20'
])
</script>

<template>
  <div
    class="flex"
    :class="compact ? 'flex-col gap-2.5' : 'flex-col items-center gap-2 text-center'"
  >
    <!-- avatar + identity -->
    <div
      class="flex items-center gap-3"
      :class="compact ? '' : 'flex-col gap-2.5'"
    >
      <img
        v-if="avatar"
        :src="avatar.url"
        :alt="avatar.alt || name"
        loading="lazy"
        class="object-cover"
        :class="avatarClass"
      >
      <div :class="compact ? '' : 'space-y-0.5'">
        <p class="text-lg font-semibold leading-tight">
          {{ name }}
        </p>
        <p
          v-if="headline"
          class="text-[13px] text-muted-foreground"
        >
          {{ headline }}
        </p>
      </div>
    </div>

    <!-- bio -->
    <p
      v-if="bio"
      class="text-sm leading-relaxed text-muted-foreground line-clamp-4"
    >
      {{ bio }}
    </p>

    <!-- social icons: icon-only ghost buttons with labels (§13/34) -->
    <div
      v-if="socials.length"
      class="flex flex-wrap items-center gap-1"
      :class="compact ? '' : 'justify-center'"
    >
      <a
        v-for="social in socials"
        :key="social.platform + social.url"
        :href="social.url"
        :target="social.url.startsWith('http') ? '_blank' : undefined"
        :rel="social.url.startsWith('http') ? 'noopener noreferrer' : undefined"
        class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        :aria-label="social.label || social.platform"
        :title="social.label || social.platform"
      >
        <component
          :is="socialIcon(social.platform)"
          class="h-4 w-4"
        />
      </a>
    </div>

    <!-- light CTA (§35) -->
    <a
      v-if="cta && cta.external"
      :href="cta.url"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-accent"
    >
      {{ cta.label }} →
    </a>
    <NuxtLink
      v-else-if="cta"
      :to="cta.url"
      class="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-accent"
    >
      {{ cta.label }} →
    </NuxtLink>

    <NuxtLink
      v-if="safeProfileUrl"
      :to="safeProfileUrl"
      class="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-accent"
    >
      {{ t('public.profile.viewProfile') }} →
    </NuxtLink>
  </div>
</template>
