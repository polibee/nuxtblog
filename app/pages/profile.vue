<script setup lang="ts">
import { MapPinIcon, ArrowUpRightIcon, CircleCheckIcon } from 'lucide-vue-next'

/* P29 /profile: modular professional profile page (docs/ai优化.txt §1-2).
   Hero + enabled sections rendered in admin-defined sort order. */

definePageMeta({ layout: 'public-full' })

const { t } = useI18n()
const { localeCode } = useLocale()

interface ProfileData {
  displayName: string
  headline: string
  bio: string
  avatar: { url: string, alt: string } | null
  location: string
  socials: Array<{ platform: string, url: string, handle: string, description: string }>
  heroSocials: Array<{ platform: string, url: string, handle: string, description: string }>
  sections: Array<{ type: string }>
  experiences: Array<{ role: string, organization: string, period: string, current: boolean, location: string, description: string | null, url: string | null }>
  projects: Array<{ name: string, description: string, image: string | null, url: string, githubUrl: string, tags: string[], featured: boolean }>
  skills: Array<{ group: string, name: string }>
  education: Array<{ school: string, program: string, period: string, details: string }>
  certifications: Array<{ name: string, issuer: string, dateIssued: string, url: string | null }>
  focusItems: string[]
}

const { data } = await useFetch<ProfileData | null>(
  '/api/public/profile',
  { key: `profile-${localeCode.value}`, lazy: true }
)

const profile = computed(() => data.value)

const SECTION_LABELS: Record<string, string> = {
  about: 'public.profile.sectionAbout',
  experience: 'public.profile.sectionExperience',
  projects: 'public.profile.sectionProjects',
  skills: 'public.profile.sectionSkills',
  social: 'public.profile.sectionSocial',
  focus: 'public.profile.sectionFocus',
  education: 'public.profile.sectionEducation',
  certifications: 'public.profile.sectionCertifications',
  contact: 'public.profile.sectionContact'
}

function sectionTitle(type: string): string {
  return t(SECTION_LABELS[type] ?? 'public.profile.sectionAbout')
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
    <UiEmpty v-if="!profile">
      <template #title>
        {{ t('public.profile.empty') }}
      </template>
    </UiEmpty>

    <div
      v-else
      class="space-y-12"
    >
      <!-- hero -->
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
        <div
          v-if="profile.heroSocials.length"
          class="mt-1 flex flex-wrap items-center justify-center gap-1"
        >
          <a
            v-for="social in profile.heroSocials"
            :key="social.platform + social.url"
            :href="social.url"
            :target="isExternal(social.url) ? '_blank' : undefined"
            :rel="isExternal(social.url) ? 'noopener noreferrer' : undefined"
            class="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            :aria-label="social.handle || social.platform"
            :title="social.handle || social.platform"
          >
            <component
              :is="socialIcon(social.platform)"
              class="h-4 w-4"
            />
          </a>
        </div>
      </section>

      <!-- enabled sections in admin-defined order -->
      <section
        v-for="section in profile.sections"
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
          <article
            v-for="(project, i) in profile.projects"
            :key="i"
            class="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
          >
            <img
              v-if="project.image"
              :src="project.image"
              :alt="project.name"
              loading="lazy"
              class="aspect-[16/9] w-full object-cover"
            >
            <div
              v-else
              class="flex aspect-[16/9] w-full items-center justify-center bg-muted text-lg font-semibold text-muted-foreground"
            >
              {{ (project.name || 'P').slice(0, 1).toUpperCase() }}
            </div>
            <div class="flex flex-1 flex-col gap-2 p-4">
              <div class="flex items-center justify-between gap-2">
                <h3 class="font-medium leading-tight">
                  {{ project.name }}
                </h3>
                <span
                  v-if="project.featured"
                  class="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                >★</span>
              </div>
              <p
                v-if="project.description"
                class="line-clamp-3 text-sm leading-relaxed text-muted-foreground"
              >
                {{ project.description }}
              </p>
              <div
                v-if="project.tags.length"
                class="flex flex-wrap gap-1"
              >
                <span
                  v-for="tag in project.tags"
                  :key="tag"
                  class="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >{{ tag }}</span>
              </div>
              <div class="mt-auto flex gap-3 pt-1 text-sm">
                <a
                  v-if="project.url"
                  :href="project.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-0.5 text-primary hover:underline"
                >{{ t('public.profile.visit') }}<ArrowUpRightIcon class="h-3.5 w-3.5" /></a>
                <a
                  v-if="project.githubUrl"
                  :href="project.githubUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
                >
                  <component
                    :is="socialIcon('github')"
                    class="h-3.5 w-3.5"
                  />GitHub</a>
              </div>
            </div>
          </article>
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
