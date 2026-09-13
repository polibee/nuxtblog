<script setup lang="ts">
import { MapPinIcon, ArrowUpRightIcon, CircleCheckIcon } from 'lucide-vue-next'

/* P29 /profile: personal profile sections rendered in admin-defined sort order. */

definePageMeta({ layout: 'public-full', alias: ['/en/profile'] })

const { t } = useI18n()
const { localeCode } = useLocale()

interface ProfileData {
  displayName: string
  headline: string
  bio: string
  avatar: { url: string, alt: string } | null
  location: string
  socials: Array<{ platform: string, url: string, handle: string, description: string }>
  sections: Array<{ type: string }>
  experiences: Array<{ role: string, organization: string, period: string, current: boolean, location: string, description: string | null, url: string | null }>
  projects: Array<{ name: string, description: string, image: string | null, url: string, githubUrl: string, tags: string[], featured: boolean }>
  skills: Array<{ group: string, name: string }>
  education: Array<{ school: string, program: string, period: string, details: string }>
  certifications: Array<{ name: string, issuer: string, dateIssued: string, url: string | null }>
  focusItems: string[]
}

const { data, status, error, refresh } = await useFetch<ProfileData | null>(
  '/api/public/profile',
  { key: `profile-${localeCode.value}`, query: { locale: localeCode.value }, lazy: true }
)

const profile = computed(() => data.value)

const visibleSections = computed(() => {
  const current = profile.value
  if (!current) return []
  const content: Record<string, unknown> = {
    about: current.bio,
    experience: current.experiences,
    projects: current.projects,
    skills: current.skills,
    social: current.socials,
    contact: current.socials,
    focus: current.focusItems,
    education: current.education,
    certifications: current.certifications
  }
  const hasContent = (value: unknown) => Array.isArray(value) ? value.length > 0 : Boolean(typeof value === 'string' ? value.trim() : value)
  return current.sections.filter(section => hasContent(content[section.type]))
})

function sectionTitle(type: string): string {
  switch (type) {
    case 'experience': return t('public.profile.sectionExperience')
    case 'projects': return t('public.profile.sectionProjects')
    case 'skills': return t('public.profile.sectionSkills')
    case 'social': return t('public.profile.sectionSocial')
    case 'focus': return t('public.profile.sectionFocus')
    case 'education': return t('public.profile.sectionEducation')
    case 'certifications': return t('public.profile.sectionCertifications')
    case 'contact': return t('public.profile.sectionContact')
    case 'about':
    default: return t('public.profile.sectionAbout')
  }
}

const skillGroups = computed(() => {
  const map = new Map<string, string[]>()
  for (const s of profile.value?.skills ?? []) {
    const group = s.group || t('public.profile.skillsOther')
    if (!map.has(group)) map.set(group, [])
    map.get(group)!.push(s.name)
  }
  return [...map.entries()].map(([group, names]) => ({ group, names }))
})

const isExternal = (url: string) => /^https?:\/\//i.test(url)

useSeoMeta({
  title: () => profile.value?.displayName ?? t('public.profile.title'),
  description: () => profile.value?.headline || profile.value?.bio.slice(0, 150) || ''
})
</script>

<template>
  <div>
    <div
      v-if="status === 'pending'"
      class="space-y-6"
      aria-live="polite"
    >
      <UiSkeleton class="h-64 w-full rounded-[2rem]" />
      <UiSkeleton class="h-96 w-full rounded-2xl" />
    </div>

    <div
      v-else-if="error"
      class="flex flex-col items-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center"
      role="alert"
    >
      <p class="text-sm text-destructive">
        {{ t('public.profile.loadFailed') }}
      </p>
      <button
        type="button"
        class="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        @click="refresh()"
      >
        {{ t('public.profile.retry') }}
      </button>
    </div>

    <UiEmpty v-else-if="!profile">
      <template #title>
        {{ t('public.profile.empty') }}
      </template>
    </UiEmpty>

    <div
      v-else-if="profile"
      class="space-y-12"
    >
      <section class="flex flex-col items-center gap-3 border-b pb-10 text-center">
        <img
          v-if="profile.avatar"
          :src="profile.avatar.url"
          :alt="profile.avatar.alt"
          class="h-24 w-24 rounded-full object-cover"
        >
        <div
          v-else
          class="flex h-24 w-24 items-center justify-center rounded-full bg-muted text-3xl font-semibold text-muted-foreground"
        >
          {{ (profile.displayName || 'A').slice(0, 1).toUpperCase() }}
        </div>
        <h1 class="text-3xl font-bold tracking-tight">
          {{ profile.displayName }}
        </h1>
        <p
          v-if="profile.headline"
          class="text-base text-muted-foreground"
        >
          {{ profile.headline }}
        </p>
        <p
          v-if="profile.location"
          class="flex items-center gap-1 text-sm text-muted-foreground"
        >
          <MapPinIcon class="h-4 w-4" />
          {{ profile.location }}
        </p>
      </section>

      <!-- enabled personal profile sections in admin-defined order -->
      <section
        v-for="section in visibleSections"
        :key="section.type"
        class="space-y-4"
      >
        <h2 class="text-xl font-semibold tracking-tight">
          {{ sectionTitle(section.type) }}
        </h2>

        <!-- about -->
        <p
          v-if="section.type === 'about'"
          class="max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground"
        >
          {{ profile.bio }}
        </p>

        <!-- experience: timeline -->
        <ol
          v-else-if="section.type === 'experience'"
          class="max-w-3xl space-y-6 border-l pl-5"
        >
          <li
            v-for="(exp, i) in profile.experiences"
            :key="i"
            class="relative space-y-1"
          >
            <span class="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="font-medium">
                {{ exp.role }}
                <span class="text-muted-foreground">· {{ exp.organization }}</span>
              </p>
              <span class="font-mono text-xs text-muted-foreground">{{ exp.period }}</span>
            </div>
            <p
              v-if="exp.location || exp.current"
              class="text-xs text-muted-foreground"
            >
              <span v-if="exp.location">{{ exp.location }}</span>
              <span
                v-if="exp.current"
                class="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
              >{{ t('public.profile.current') }}</span>
            </p>
            <p
              v-if="exp.description"
              class="text-sm leading-relaxed text-muted-foreground"
            >
              {{ exp.description }}
            </p>
            <a
              v-if="exp.url"
              :href="exp.url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-0.5 text-sm text-primary hover:underline"
            >{{ exp.url.replace(/^https?:\/\//, '') }}<ArrowUpRightIcon class="h-3.5 w-3.5" /></a>
          </li>
        </ol>

        <!-- projects: grid cards -->
        <div
          v-else-if="section.type === 'projects'"
          class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div
            v-for="(project, i) in profile.projects"
            :key="i"
          >
            <ProfileProjectCard
              :project="project"
              :index="i"
            />
          </div>
        </div>

        <!-- skills: grouped badges -->
        <div
          v-else-if="section.type === 'skills'"
          class="max-w-3xl space-y-4"
        >
          <div
            v-for="group in skillGroups"
            :key="group.group"
            class="flex flex-wrap items-baseline gap-2"
          >
            <p class="w-28 shrink-0 text-sm font-medium">
              {{ group.group }}
            </p>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="name in group.names"
                :key="name"
                class="rounded-md border px-2 py-0.5 text-xs text-muted-foreground"
              >{{ name }}</span>
            </div>
          </div>
        </div>

        <!-- social / contact: channel list -->
        <ul
          v-else-if="section.type === 'social' || section.type === 'contact'"
          class="grid max-w-3xl gap-2 sm:grid-cols-2"
        >
          <li
            v-for="social in profile.socials"
            :key="social.platform + social.url"
          >
            <a
              :href="social.url"
              :target="isExternal(social.url) ? '_blank' : undefined"
              :rel="isExternal(social.url) ? 'noopener noreferrer' : undefined"
              class="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
            >
              <component
                :is="socialIcon(social.platform)"
                class="h-5 w-5 shrink-0 text-muted-foreground"
              />
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium">{{ social.handle || social.platform }}</span>
                <span
                  v-if="social.description"
                  class="block truncate text-xs text-muted-foreground"
                >{{ social.description }}</span>
              </span>
              <ArrowUpRightIcon class="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
            </a>
          </li>
        </ul>

        <!-- focus: current focus list -->
        <ul
          v-else-if="section.type === 'focus'"
          class="max-w-3xl space-y-2"
        >
          <li
            v-for="(item, i) in profile.focusItems"
            :key="i"
            class="flex items-start gap-2 text-[15px] text-muted-foreground"
          >
            <CircleCheckIcon class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {{ item }}
          </li>
        </ul>

        <!-- education -->
        <ol
          v-else-if="section.type === 'education'"
          class="max-w-3xl space-y-4"
        >
          <li
            v-for="(edu, i) in profile.education"
            :key="i"
            class="space-y-0.5"
          >
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="font-medium">
                {{ edu.school }}
                <span class="text-muted-foreground">· {{ edu.program }}</span>
              </p>
              <span class="font-mono text-xs text-muted-foreground">{{ edu.period }}</span>
            </div>
            <p
              v-if="edu.details"
              class="text-sm text-muted-foreground"
            >
              {{ edu.details }}
            </p>
          </li>
        </ol>

        <!-- certifications -->
        <ol
          v-else-if="section.type === 'certifications'"
          class="max-w-3xl space-y-3"
        >
          <li
            v-for="(cert, i) in profile.certifications"
            :key="i"
            class="flex flex-wrap items-baseline justify-between gap-2"
          >
            <p class="text-[15px]">
              {{ cert.name }}
              <span class="text-sm text-muted-foreground">· {{ cert.issuer }}</span>
            </p>
            <span class="flex items-center gap-3">
              <a
                v-if="cert.url"
                :href="cert.url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-0.5 text-sm text-primary hover:underline"
              >{{ t('public.profile.verify') }}<ArrowUpRightIcon class="h-3.5 w-3.5" /></a>
              <span class="font-mono text-xs text-muted-foreground">{{ cert.dateIssued }}</span>
            </span>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>
