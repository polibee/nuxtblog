<script setup lang="ts">
import MediaPickerField from '~/admin/framework/MediaPickerField.vue'
import { useI18n } from '~/admin/i18n'
import { notify, notifyError } from '~/admin/notifications/notify'
import { AUTHOR_SOCIAL_PLATFORMS } from '#shared/schemas/author-card'

/* P29 profile editor (docs/ai优化.txt §2): one page, one bulk save.
   Collections are repeaters; section order is managed with up/down
   (sortOrder derives from array index on save). */

defineProps<{ resource: { name: string } }>()

const { t } = useI18n()

interface ProfileForm {
  displayName: string
  headline: string
  bio: string
  avatarMediaId: number | null
  location: string
}
interface SocialForm {
  platform: string
  url: string
  handle: string
  description: string
  showInHero: boolean
  showInSocial: boolean
}
interface SectionForm { type: string, enabled: boolean }
interface ExperienceForm { role: string, organization: string, period: string, current: boolean, location: string, description: string, url: string }
interface ProjectForm { name: string, description: string, imageMediaId: number | null, url: string, githubUrl: string, tags: string, featured: boolean }
interface SkillForm { groupName: string, name: string }
interface EducationForm { school: string, program: string, period: string, details: string }
interface CertificationForm { name: string, issuer: string, dateIssued: string, url: string }
interface FocusForm { text: string }

const SECTION_ORDER = ['about', 'experience', 'projects', 'skills', 'social', 'focus', 'education', 'certifications', 'contact'] as const

const form = reactive({
  profile: {
    displayName: '',
    headline: '',
    bio: '',
    avatarMediaId: null as number | null,
    location: ''
  } as ProfileForm,
  socials: [] as SocialForm[],
  sections: SECTION_ORDER.map(type => ({ type, enabled: type === 'about' })) as SectionForm[],
  experiences: [] as ExperienceForm[],
  projects: [] as ProjectForm[],
  skills: [] as SkillForm[],
  education: [] as EducationForm[],
  certifications: [] as CertificationForm[],
  focusItems: [] as FocusForm[]
})

const loading = ref(false)

const PLATFORM_OPTIONS = AUTHOR_SOCIAL_PLATFORMS.map(p => ({ value: p, label: p }))

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const res = await $fetch<Record<string, unknown>>('/api/admin/author/profile')
    const p = (res.profile ?? {}) as Record<string, unknown>
    form.profile = {
      displayName: String(p.displayName ?? ''),
      headline: String(p.headline ?? ''),
      bio: String(p.bio ?? ''),
      avatarMediaId: Number(p.avatarMediaId) || null,
      location: String(p.location ?? '')
    }
    form.socials = asArray<SocialForm>(res.socials).map(s => ({
      platform: String(s.platform ?? 'custom'),
      url: String(s.url ?? ''),
      handle: String(s.handle ?? ''),
      description: String(s.description ?? ''),
      showInHero: Boolean(s.showInHero),
      showInSocial: Boolean(s.showInSocial)
    }))
    const savedSections = asArray<SectionForm>(res.sections)
    form.sections = SECTION_ORDER.map((type) => {
      const saved = savedSections.find(s => s.type === type)
      return { type, enabled: saved ? Boolean(saved.enabled) : type === 'about' }
    })
    form.experiences = asArray<ExperienceForm>(res.experiences).map(e => ({
      role: String(e.role ?? ''),
      organization: String(e.organization ?? ''),
      period: String(e.period ?? ''),
      current: Boolean(e.current),
      location: String(e.location ?? ''),
      description: String(e.description ?? ''),
      url: String(e.url ?? '')
    }))
    form.projects = asArray<ProjectForm>(res.projects).map(pr => ({
      name: String(pr.name ?? ''),
      description: String(pr.description ?? ''),
      imageMediaId: Number(pr.imageMediaId) || null,
      url: String(pr.url ?? ''),
      githubUrl: String(pr.githubUrl ?? ''),
      tags: String(pr.tags ?? ''),
      featured: Boolean(pr.featured)
    }))
    form.skills = asArray<SkillForm>(res.skills).map(s => ({
      groupName: String(s.groupName ?? ''),
      name: String(s.name ?? '')
    }))
    form.education = asArray<EducationForm>(res.education).map(e => ({
      school: String(e.school ?? ''),
      program: String(e.program ?? ''),
      period: String(e.period ?? ''),
      details: String(e.details ?? '')
    }))
    form.certifications = asArray<CertificationForm>(res.certifications).map(c => ({
      name: String(c.name ?? ''),
      issuer: String(c.issuer ?? ''),
      dateIssued: String(c.dateIssued ?? ''),
      url: String(c.url ?? '')
    }))
    form.focusItems = asArray<FocusForm>(res.focusItems).map(f => ({ text: String(f.text ?? '') }))
  } finally {
    loading.value = false
  }
}

function move<T>(list: T[], index: number, delta: -1 | 1): void {
  const target = index + delta
  if (target < 0 || target >= list.length) return
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item!)
}

async function save(): Promise<void> {
  if (!form.profile.displayName.trim()) {
    notifyError(t('res.profile.saveFailed'), t('res.profile.nameRequired'))
    return
  }
  try {
    await $fetch('/api/admin/author/profile', {
      method: 'PUT',
      body: JSON.parse(JSON.stringify(form))
    })
    notify(t('res.profile.saved'))
  } catch (e) {
    notifyError(t('res.profile.saveFailed'), (e as Error).message)
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ t('res.profile.label') }}
        <NuxtLink
          to="/profile"
          target="_blank"
          class="ml-2 align-middle text-sm font-normal text-primary hover:underline"
        >{{ t('res.profile.viewPublic') }} ↗</NuxtLink>
      </h1>
      <UiButton
        :disabled="loading"
        @click="save"
      >
        {{ t('common.save') }}
      </UiButton>
    </div>

    <!-- basic -->
    <div class="rounded-xl border p-5">
      <h2 class="mb-3 text-sm font-semibold">
        {{ t('res.profile.basic') }}
      </h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('res.profile.displayName') }}</span>
          <input
            v-model="form.profile.displayName"
            maxlength="60"
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
        </label>
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('res.profile.headline') }}</span>
          <input
            v-model="form.profile.headline"
            maxlength="100"
            placeholder="Software Engineer · Writer"
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
        </label>
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('res.profile.location') }}</span>
          <input
            v-model="form.profile.location"
            maxlength="60"
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
        </label>
      </div>
      <label class="mt-3 block space-y-1 text-sm">
        <span class="text-muted-foreground">{{ t('res.profile.bio') }}</span>
        <textarea
          v-model="form.profile.bio"
          rows="4"
          class="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </label>
      <div class="mt-3">
        <p class="mb-1 text-sm text-muted-foreground">
          {{ t('res.profile.avatar') }}
        </p>
        <MediaPickerField
          :model-value="form.profile.avatarMediaId"
          usage="avatar"
          recommended="512 × 512"
          @update:model-value="form.profile.avatarMediaId = $event"
        />
      </div>
    </div>

    <!-- sections: enable + order -->
    <div class="rounded-xl border p-5">
      <h2 class="mb-3 text-sm font-semibold">
        {{ t('res.profile.sections') }}
      </h2>
      <div class="space-y-1.5">
        <div
          v-for="(section, i) in form.sections"
          :key="section.type"
          class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
        >
          <span class="text-sm">{{ t(`res.profile.sectionType.${section.type}`) }}</span>
          <span class="flex items-center gap-2">
            <button
              type="button"
              class="h-7 w-7 rounded-md border text-xs hover:bg-accent disabled:opacity-40"
              :disabled="i === 0"
              @click="move(form.sections, i, -1)"
            >↑</button>
            <button
              type="button"
              class="h-7 w-7 rounded-md border text-xs hover:bg-accent disabled:opacity-40"
              :disabled="i === form.sections.length - 1"
              @click="move(form.sections, i, 1)"
            >↓</button>
            <UiSwitch
              :model-value="section.enabled"
              @update:model-value="section.enabled = $event as boolean"
            />
          </span>
        </div>
      </div>
    </div>

    <!-- social channels -->
    <div class="rounded-xl border p-5">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold">
          {{ t('res.profile.socialChannels') }}
        </h2>
        <UiButton
          size="sm"
          variant="outline"
          @click="form.socials.push({ platform: 'github', url: '', handle: '', description: '', showInHero: true, showInSocial: true })"
        >
          + {{ t('res.profile.add') }}
        </UiButton>
      </div>
      <p
        v-if="form.socials.length === 0"
        class="text-xs text-muted-foreground"
      >
        {{ t('res.profile.noSocial') }}
      </p>
      <div class="space-y-3">
        <div
          v-for="(social, i) in form.socials"
          :key="i"
          class="space-y-2 rounded-lg border p-3"
        >
          <div class="flex flex-wrap items-center gap-2">
            <select
              v-model="social.platform"
              class="h-9 w-32 rounded-md border bg-background px-2 text-sm"
            >
              <option
                v-for="option in PLATFORM_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
            <input
              v-model="social.url"
              :placeholder="social.platform === 'email' ? 'mailto:...' : 'https://...'"
              class="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
            >
            <input
              v-model="social.handle"
              :placeholder="t('res.profile.handle')"
              maxlength="50"
              class="h-9 w-36 rounded-md border bg-background px-3 text-sm"
            >
            <span class="flex items-center gap-1">
              <button
                type="button"
                class="h-7 w-7 rounded-md border text-xs hover:bg-accent disabled:opacity-40"
                :disabled="i === 0"
                @click="move(form.socials, i, -1)"
              >↑</button>
              <button
                type="button"
                class="h-7 w-7 rounded-md border text-xs hover:bg-accent disabled:opacity-40"
                :disabled="i === form.socials.length - 1"
                @click="move(form.socials, i, 1)"
              >↓</button>
              <button
                type="button"
                class="h-9 w-9 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
                @click="form.socials.splice(i, 1)"
              >✕</button>
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <input
              v-model="social.description"
              :placeholder="t('res.profile.description')"
              maxlength="80"
              class="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
            >
            <label class="flex items-center gap-1">
              <input
                v-model="social.showInHero"
                type="checkbox"
                class="h-3.5 w-3.5"
              >{{ t('res.profile.showInHero') }}
            </label>
            <label class="flex items-center gap-1">
              <input
                v-model="social.showInSocial"
                type="checkbox"
                class="h-3.5 w-3.5"
              >{{ t('res.profile.showInSocial') }}
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- experiences -->
    <div class="rounded-xl border p-5">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold">
          {{ t('res.profile.experiences') }}
        </h2>
        <UiButton
          size="sm"
          variant="outline"
          @click="form.experiences.push({ role: '', organization: '', period: '', current: false, location: '', description: '', url: '' })"
        >
          + {{ t('res.profile.add') }}
        </UiButton>
      </div>
      <div class="space-y-3">
        <div
          v-for="(exp, i) in form.experiences"
          :key="i"
          class="space-y-2 rounded-lg border p-3"
        >
          <div class="flex flex-wrap items-center gap-2">
            <input
              v-model="exp.role"
              :placeholder="t('res.profile.role')"
              maxlength="80"
              class="h-9 w-44 rounded-md border bg-background px-3 text-sm"
            >
            <input
              v-model="exp.organization"
              :placeholder="t('res.profile.organization')"
              maxlength="80"
              class="h-9 w-44 rounded-md border bg-background px-3 text-sm"
            >
            <input
              v-model="exp.period"
              :placeholder="t('res.profile.period')"
              maxlength="40"
              class="h-9 w-40 rounded-md border bg-background px-3 text-sm"
            >
            <label class="flex items-center gap-1 text-xs text-muted-foreground">
              <input
                v-model="exp.current"
                type="checkbox"
                class="h-3.5 w-3.5"
              >{{ t('res.profile.current') }}
            </label>
            <span class="ml-auto flex items-center gap-1">
              <button
                type="button"
                class="h-7 w-7 rounded-md border text-xs hover:bg-accent disabled:opacity-40"
                :disabled="i === 0"
                @click="move(form.experiences, i, -1)"
              >↑</button>
              <button
                type="button"
                class="h-7 w-7 rounded-md border text-xs hover:bg-accent disabled:opacity-40"
                :disabled="i === form.experiences.length - 1"
                @click="move(form.experiences, i, 1)"
              >↓</button>
              <button
                type="button"
                class="h-9 w-9 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
                @click="form.experiences.splice(i, 1)"
              >✕</button>
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <input
              v-model="exp.location"
              :placeholder="t('res.profile.location')"
              maxlength="60"
              class="h-9 w-44 rounded-md border bg-background px-3 text-sm"
            >
            <input
              v-model="exp.url"
              placeholder="https://..."
              class="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
            >
          </div>
          <textarea
            v-model="exp.description"
            :placeholder="t('res.profile.description')"
            rows="2"
            class="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
    </div>

    <!-- projects -->
    <div class="rounded-xl border p-5">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold">
          {{ t('res.profile.projects') }}
        </h2>
        <UiButton
          size="sm"
          variant="outline"
          @click="form.projects.push({ name: '', description: '', imageMediaId: null, url: '', githubUrl: '', tags: '', featured: false })"
        >
          + {{ t('res.profile.add') }}
        </UiButton>
      </div>
      <div class="space-y-3">
        <div
          v-for="(project, i) in form.projects"
          :key="i"
          class="space-y-2 rounded-lg border p-3"
        >
          <div class="flex flex-wrap items-center gap-2">
            <input
              v-model="project.name"
              :placeholder="t('res.profile.projectName')"
              maxlength="80"
              class="h-9 w-52 rounded-md border bg-background px-3 text-sm"
            >
            <input
              v-model="project.tags"
              :placeholder="t('res.profile.tags')"
              class="h-9 w-52 rounded-md border bg-background px-3 text-sm"
            >
            <label class="flex items-center gap-1 text-xs text-muted-foreground">
              <input
                v-model="project.featured"
                type="checkbox"
                class="h-3.5 w-3.5"
              >{{ t('res.profile.featured') }}
            </label>
            <span class="ml-auto flex items-center gap-1">
              <button
                type="button"
                class="h-7 w-7 rounded-md border text-xs hover:bg-accent disabled:opacity-40"
                :disabled="i === 0"
                @click="move(form.projects, i, -1)"
              >↑</button>
              <button
                type="button"
                class="h-7 w-7 rounded-md border text-xs hover:bg-accent disabled:opacity-40"
                :disabled="i === form.projects.length - 1"
                @click="move(form.projects, i, 1)"
              >↓</button>
              <button
                type="button"
                class="h-9 w-9 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
                @click="form.projects.splice(i, 1)"
              >✕</button>
            </span>
          </div>
          <textarea
            v-model="project.description"
            :placeholder="t('res.profile.description')"
            rows="2"
            class="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <div class="flex flex-wrap items-center gap-2">
            <input
              v-model="project.url"
              placeholder="https://..."
              class="h-9 w-56 rounded-md border bg-background px-3 text-sm"
            >
            <input
              v-model="project.githubUrl"
              :placeholder="t('res.profile.githubUrl')"
              class="h-9 w-56 rounded-md border bg-background px-3 text-sm"
            >
          </div>
          <MediaPickerField
            :model-value="project.imageMediaId"
            usage="cover"
            recommended="1280 × 720"
            @update:model-value="project.imageMediaId = $event"
          />
        </div>
      </div>
    </div>

    <!-- skills / education / certifications / focus: two-column grid -->
    <div class="grid gap-5 lg:grid-cols-2">
      <div class="rounded-xl border p-5">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold">
            {{ t('res.profile.skills') }}
          </h2>
          <UiButton
            size="sm"
            variant="outline"
            @click="form.skills.push({ groupName: '', name: '' })"
          >
            + {{ t('res.profile.add') }}
          </UiButton>
        </div>
        <div class="space-y-2">
          <div
            v-for="(skill, i) in form.skills"
            :key="i"
            class="flex items-center gap-2"
          >
            <input
              v-model="skill.groupName"
              :placeholder="t('res.profile.group')"
              maxlength="40"
              class="h-9 w-32 rounded-md border bg-background px-3 text-sm"
            >
            <input
              v-model="skill.name"
              :placeholder="t('res.profile.name')"
              maxlength="40"
              class="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
            >
            <button
              type="button"
              class="h-7 w-7 rounded-md border text-xs hover:bg-accent disabled:opacity-40"
              :disabled="i === 0"
              @click="move(form.skills, i, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="h-9 w-9 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
              @click="form.skills.splice(i, 1)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <div class="rounded-xl border p-5">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold">
            {{ t('res.profile.focus') }}
          </h2>
          <UiButton
            size="sm"
            variant="outline"
            @click="form.focusItems.push({ text: '' })"
          >
            + {{ t('res.profile.add') }}
          </UiButton>
        </div>
        <div class="space-y-2">
          <div
            v-for="(item, i) in form.focusItems"
            :key="i"
            class="flex items-center gap-2"
          >
            <input
              v-model="item.text"
              maxlength="120"
              class="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
            >
            <button
              type="button"
              class="h-7 w-7 rounded-md border text-xs hover:bg-accent disabled:opacity-40"
              :disabled="i === 0"
              @click="move(form.focusItems, i, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="h-9 w-9 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
              @click="form.focusItems.splice(i, 1)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <div class="rounded-xl border p-5">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold">
            {{ t('res.profile.education') }}
          </h2>
          <UiButton
            size="sm"
            variant="outline"
            @click="form.education.push({ school: '', program: '', period: '', details: '' })"
          >
            + {{ t('res.profile.add') }}
          </UiButton>
        </div>
        <div class="space-y-3">
          <div
            v-for="(edu, i) in form.education"
            :key="i"
            class="space-y-2 rounded-lg border p-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <input
                v-model="edu.school"
                :placeholder="t('res.profile.school')"
                maxlength="80"
                class="h-9 w-44 rounded-md border bg-background px-3 text-sm"
              >
              <input
                v-model="edu.program"
                :placeholder="t('res.profile.program')"
                maxlength="80"
                class="h-9 w-44 rounded-md border bg-background px-3 text-sm"
              >
              <input
                v-model="edu.period"
                :placeholder="t('res.profile.period')"
                maxlength="40"
                class="h-9 w-36 rounded-md border bg-background px-3 text-sm"
              >
              <button
                type="button"
                class="ml-auto h-9 w-9 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
                @click="form.education.splice(i, 1)"
              >
                ✕
              </button>
            </div>
            <input
              v-model="edu.details"
              :placeholder="t('res.profile.details')"
              maxlength="200"
              class="w-full rounded-md border bg-background px-3 text-sm"
            >
          </div>
        </div>
      </div>

      <div class="rounded-xl border p-5">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold">
            {{ t('res.profile.certifications') }}
          </h2>
          <UiButton
            size="sm"
            variant="outline"
            @click="form.certifications.push({ name: '', issuer: '', dateIssued: '', url: '' })"
          >
            + {{ t('res.profile.add') }}
          </UiButton>
        </div>
        <div class="space-y-3">
          <div
            v-for="(cert, i) in form.certifications"
            :key="i"
            class="space-y-2 rounded-lg border p-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <input
                v-model="cert.name"
                :placeholder="t('res.profile.name')"
                maxlength="80"
                class="h-9 w-44 rounded-md border bg-background px-3 text-sm"
              >
              <input
                v-model="cert.issuer"
                :placeholder="t('res.profile.issuer')"
                maxlength="80"
                class="h-9 w-44 rounded-md border bg-background px-3 text-sm"
              >
              <input
                v-model="cert.dateIssued"
                :placeholder="t('res.profile.dateIssued')"
                maxlength="20"
                class="h-9 w-32 rounded-md border bg-background px-3 text-sm"
              >
              <button
                type="button"
                class="ml-auto h-9 w-9 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
                @click="form.certifications.splice(i, 1)"
              >
                ✕
              </button>
            </div>
            <input
              v-model="cert.url"
              placeholder="https://..."
              class="w-full rounded-md border bg-background px-3 text-sm"
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
