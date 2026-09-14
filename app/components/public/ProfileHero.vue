<script setup lang="ts">
import { MapPinIcon, ArrowUpRightIcon } from 'lucide-vue-next'
import type { AuthorSocial } from '#shared/schemas/author-card'
import AuthorCardView from '~/components/public/AuthorCardView.vue'

interface ProfileHeroData {
  displayName: string
  headline: string
  bio: string
  avatar: { url: string, alt: string } | null
  location: string
  heroSocials: Array<{ platform: string, url: string, handle: string, description: string }>
}

const props = defineProps<{ profile: ProfileHeroData }>()
const { t } = useI18n()
const { publicPath } = useLocale()

const socials = computed<AuthorSocial[]>(() => props.profile.heroSocials.map(social => ({
  platform: social.platform,
  url: social.url,
  label: social.handle || social.description || social.platform
})))
</script>

<template>
  <section
    class="grid gap-7 overflow-hidden rounded-[2rem] border bg-card/80 p-6 shadow-sm sm:p-8 lg:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)] lg:items-center"
    aria-labelledby="profile-hero-title"
  >
    <div class="flex justify-center border-b pb-7 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
      <AuthorCardView
        variant="profileHero"
        layout="centered"
        :name="profile.displayName"
        :headline="profile.headline"
        :avatar="profile.avatar"
        :socials="socials"
        :profile-url="publicPath('/profile')"
      />
    </div>

    <div class="space-y-5">
      <div class="space-y-3">
        <p class="text-sm font-medium text-primary">
          {{ t('public.profile.heroEyebrow') }}
        </p>
        <h1
          id="profile-hero-title"
          class="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          {{ profile.headline || profile.displayName }}
        </h1>
        <p
          v-if="profile.bio"
          class="max-w-2xl whitespace-pre-line text-[15px] leading-7 text-muted-foreground"
        >
          {{ profile.bio }}
        </p>
      </div>

      <p
        v-if="profile.location"
        class="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <MapPinIcon class="h-4 w-4" />
        {{ profile.location }}
      </p>

      <NuxtLink
        to="/posts"
        class="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        {{ t('public.profile.heroCta') }}
        <ArrowUpRightIcon class="h-4 w-4" />
      </NuxtLink>
    </div>
  </section>
</template>
