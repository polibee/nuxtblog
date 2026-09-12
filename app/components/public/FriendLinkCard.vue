<script setup lang="ts">
import { ExternalLinkIcon } from 'lucide-vue-next'

/* Friend link card (docs/友链.txt §5/6): logo/favicon, name, one-line
   description, domain — no admin-only health data on the public side. */

interface FriendLink {
  id: number
  name: string
  url: string
  domain: string
  description: string
  logoUrl: string | null
  featured: boolean
  nofollow: boolean
  openInNewTab: boolean
}

const props = defineProps<{ link: FriendLink }>()

const favicon = computed(() => props.link.logoUrl || `https://www.google.com/s2/favicons?domain=${props.link.domain}&sz=64`)
</script>

<template>
  <a
    :href="link.url"
    :target="link.openInNewTab ? '_blank' : undefined"
    :rel="link.nofollow ? 'noopener noreferrer nofollow' : 'noopener noreferrer'"
    class="group flex flex-col gap-2 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md"
  >
    <div class="flex items-center gap-2.5">
      <img
        :src="favicon"
        :alt="link.name"
        loading="lazy"
        class="h-8 w-8 rounded-md bg-muted object-contain p-0.5"
      >
      <p class="flex min-w-0 items-center gap-1 font-medium leading-tight">
        <span class="truncate">{{ link.name }}</span>
        <span
          v-if="link.featured"
          class="shrink-0 text-xs text-primary"
        >★</span>
      </p>
      <ExternalLinkIcon class="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
    <p
      v-if="link.description"
      class="line-clamp-2 text-sm leading-relaxed text-muted-foreground"
    >
      {{ link.description }}
    </p>
    <p class="mt-auto truncate text-xs text-muted-foreground">
      {{ link.domain }}
    </p>
  </a>
</template>
