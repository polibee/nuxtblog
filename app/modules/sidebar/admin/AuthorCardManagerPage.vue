<script setup lang="ts">
import MediaPickerField from '~/admin/framework/MediaPickerField.vue'
import { useI18n } from '~/admin/i18n'
import { notify, notifyError } from '~/admin/notifications/notify'
import { AUTHOR_SOCIAL_PLATFORMS } from '#shared/schemas/author-card'

/* Author card visual editor (Author Card 设计方案 §41-44): live 300px
   sidebar preview on the left, visual form on the right. Config JSON is
   the storage layer only — never hand-edited. */

defineProps<{ resource: { name: string } }>()

const { t } = useI18n()

interface SocialLink {
  platform: string
  url: string
  label: string
}

interface AuthorConfig {
  displayName: string
  headline: string
  bio: string
  avatarMediaId: number | null
  avatarStyle: 'circle' | 'rounded'
  layout: 'centered' | 'compact'
  showAvatar: boolean
  showHeadline: boolean
  showBio: boolean
  showSocials: boolean
  showCta: boolean
  socialLinks: SocialLink[]
  cta: { label: string, url: string, target: 'self' | 'blank' }
}

interface AuthorTranslation {
  displayName: string
  headline: string
  bio: string
  ctaLabel: string
}

const PLATFORM_OPTIONS = AUTHOR_SOCIAL_PLATFORMS.map(p => ({ value: p, label: p }))

const config = ref<AuthorConfig>({
  displayName: '',
  headline: '',
  bio: '',
  avatarMediaId: null,
  avatarStyle: 'circle',
  layout: 'centered',
  showAvatar: true,
  showHeadline: true,
  showBio: true,
  showSocials: true,
  showCta: true,
  socialLinks: [],
  cta: { label: '', url: '', target: 'self' }
})

const cardId = ref<number | null>(null)
const enabled = ref(true)
const loading = ref(false)
const avatarUrl = ref('')
const localeOptions = ref<Array<{ code: string, nativeName: string, isDefault: boolean }>>([])
const activeLocale = ref('zh-CN')
const translations = ref<Record<string, AuthorTranslation>>({})

const platformIcons: Record<string, string> = {
  github: 'GitHub',
  x: 'X',
  linkedin: 'LinkedIn',
  website: 'Website',
  email: 'Email',
  youtube: 'YouTube',
  telegram: 'Telegram',
  discord: 'Discord',
  rss: 'RSS',
  custom: 'Custom'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const [res, locales] = await Promise.all([
      $fetch<{ id: number | null, enabled: boolean, config: AuthorConfig | null, translations: Record<string, AuthorTranslation> }>('/api/admin/sidebar/author-card'),
      $fetch<{ locales: Array<{ code: string, nativeName: string, isDefault: boolean }> }>('/api/public/locales')
    ])
    localeOptions.value = locales.locales
    cardId.value = res.id
    enabled.value = res.enabled
    const loaded = res.config as Partial<AuthorConfig> | null
    if (loaded) {
      config.value = {
        ...config.value,
        ...loaded,
        cta: loaded.cta ?? { label: '', url: '', target: 'self' }
      }
    }
    translations.value = { ...res.translations }
    const defaultLocale = locales.locales.find(locale => locale.isDefault)?.code ?? locales.locales[0]?.code ?? 'zh-CN'
    activeLocale.value = defaultLocale
    const localized = translations.value[activeLocale.value]
    if (localized) applyTranslation(localized)
    else if (loaded?.displayName) translations.value[activeLocale.value] = toTranslation(loaded)
    await ensureAvatarPreview()
  } finally {
    loading.value = false
  }
}

function toTranslation(value: Partial<AuthorConfig> | undefined): AuthorTranslation {
  return {
    displayName: value?.displayName ?? '',
    headline: value?.headline ?? '',
    bio: value?.bio ?? '',
    ctaLabel: value?.cta?.label ?? ''
  }
}

function applyTranslation(value: AuthorTranslation): void {
  config.value.displayName = value.displayName
  config.value.headline = value.headline
  config.value.bio = value.bio
  config.value.cta = { ...config.value.cta, label: value.ctaLabel }
}

function saveActiveTranslation(): void {
  translations.value[activeLocale.value] = toTranslation(config.value)
}

function selectLocale(code: string): void {
  if (code === activeLocale.value) return
  saveActiveTranslation()
  activeLocale.value = code
  applyTranslation(translations.value[code] ?? { displayName: '', headline: '', bio: '', ctaLabel: '' })
}

async function ensureAvatarPreview(): Promise<void> {
  const id = config.value.avatarMediaId
  if (!id) {
    avatarUrl.value = ''
    return
  }
  try {
    const media = await $fetch<{ url?: string, storageKey?: string }>(`/api/admin/media/${id}`)
    avatarUrl.value = media.url ?? (media.storageKey ? `/media/${media.storageKey}` : '')
  } catch {
    avatarUrl.value = ''
  }
}

watch(() => config.value.avatarMediaId, () => void ensureAvatarPreview())

async function save(): Promise<void> {
  if (!config.value.displayName.trim()) {
    notifyError(t('res.authorcard.saveFailed'), t('res.authorcard.nameRequired'))
    return
  }
  try {
    saveActiveTranslation()
    const payload: Omit<AuthorConfig, 'cta'> & { cta: AuthorConfig['cta'] | null } = { ...config.value }
    const cta = config.value.cta
    payload.cta = config.value.showCta && cta && cta.label && cta.url
      ? cta
      : null
    await $fetch('/api/admin/sidebar/author-card', {
      method: 'PUT',
      body: { config: payload, enabled: enabled.value, translations: translations.value }
    })
    notify(t('res.authorcard.saved'))
    await load()
  } catch (e) {
    notifyError(t('res.authorcard.saveFailed'), (e as Error).message)
  }
}

function addSocial(): void {
  if (config.value.socialLinks.length >= 8) return
  config.value.socialLinks.push({ platform: 'github', url: '', label: '' })
}

function removeSocial(index: number): void {
  config.value.socialLinks.splice(index, 1)
}

const bioLength = computed(() => config.value.bio.length)

onMounted(load)
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[300px,1fr]">
    <!-- 左：300px 实时预览（模拟真实 Sidebar，§42-44） -->
    <div class="space-y-2">
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {{ t('res.authorcard.preview') }}
      </p>
      <div class="rounded-xl border bg-card p-5">
        <div
          class="flex"
          :class="config.layout === 'compact' ? 'flex-col gap-2.5' : 'flex-col items-center gap-2 text-center'"
        >
          <template v-if="config.showAvatar">
            <img
              v-if="avatarUrl"
              :src="avatarUrl"
              :alt="config.displayName"
              class="object-cover"
              :class="[config.avatarStyle === 'rounded' ? 'rounded-xl' : 'rounded-full', config.layout === 'compact' ? 'h-12 w-12' : 'h-20 w-20']"
            >
            <div
              v-else
              class="flex items-center justify-center bg-muted text-lg font-semibold text-muted-foreground"
              :class="[config.avatarStyle === 'rounded' ? 'rounded-xl' : 'rounded-full', config.layout === 'compact' ? 'h-12 w-12' : 'h-20 w-20']"
            >
              {{ (config.displayName || 'A').slice(0, 1).toUpperCase() }}
            </div>
          </template>
          <div :class="config.layout === 'compact' ? '' : 'space-y-0.5'">
            <p class="text-lg font-semibold leading-tight">
              {{ config.displayName || '—' }}
            </p>
            <p
              v-if="config.showHeadline && config.headline"
              class="text-[13px] text-muted-foreground"
            >
              {{ config.headline }}
            </p>
          </div>
        </div>
        <p
          v-if="config.showBio && config.bio"
          class="mt-2.5 line-clamp-4 text-sm leading-relaxed text-muted-foreground"
        >
          {{ config.bio }}
        </p>
        <div
          v-if="config.showSocials && config.socialLinks.length"
          class="mt-2.5 flex flex-wrap items-center gap-1"
          :class="config.layout === 'centered' ? 'justify-center' : ''"
        >
          <span
            v-for="(social, i) in config.socialLinks.slice(0, 5)"
            :key="i"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground"
            :title="platformIcons[social.platform] ?? social.platform"
          >
            {{ (platformIcons[social.platform] ?? '?').slice(0, 2) }}
          </span>
        </div>
        <div
          v-if="config.showCta && config.cta?.label && config.layout === 'centered'"
          class="mt-3 flex justify-center"
        >
          <span class="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium">
            {{ config.cta.label }} →
          </span>
        </div>
      </div>
      <p
        v-if="config.bio.length > 120"
        class="text-[10px] text-warning"
      >
        {{ t('res.authorcard.bioLong') }}
      </p>
    </div>

    <!-- 右：可视化表单 -->
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-semibold tracking-tight">
          {{ t('res.authorcard.label') }}
        </h1>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 text-sm text-muted-foreground">
            {{ t('res.authorcard.enabled') }}
            <UiSwitch
              :model-value="enabled"
              @update:model-value="enabled = $event as boolean"
            />
          </label>
          <UiButton
            :disabled="loading"
            @click="save"
          >
            {{ t('common.save') }}
          </UiButton>
        </div>
      </div>

      <div
        v-if="localeOptions.length"
        class="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1"
        role="tablist"
        :aria-label="t('res.authorcard.content')"
      >
        <button
          v-for="locale in localeOptions"
          :key="locale.code"
          type="button"
          role="tab"
          :aria-selected="activeLocale === locale.code"
          class="rounded-md px-3 py-1.5 text-sm transition-colors"
          :class="activeLocale === locale.code ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          @click="selectLocale(locale.code)"
        >
          {{ locale.nativeName || locale.code }}
          <span class="ml-1 text-xs text-muted-foreground">{{ locale.code }}</span>
        </button>
      </div>

      <div class="rounded-xl border p-5">
        <h2 class="mb-3 text-sm font-semibold">
          {{ t('res.authorcard.content') }}
        </h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('res.authorcard.displayName') }} *</span>
            <input
              v-model="config.displayName"
              maxlength="50"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
          </label>
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('res.authorcard.headline') }}</span>
            <input
              v-model="config.headline"
              maxlength="80"
              placeholder="Developer · Writer"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
          </label>
        </div>
        <label class="mt-3 block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('res.authorcard.bio') }}</span>
          <textarea
            v-model="config.bio"
            rows="3"
            maxlength="160"
            class="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <span class="text-[10px] text-muted-foreground">{{ bioLength }} / 160</span>
        </label>
        <div class="mt-3">
          <p class="mb-1 text-sm text-muted-foreground">
            {{ t('res.authorcard.avatar') }}
          </p>
          <MediaPickerField
            :model-value="config.avatarMediaId"
            usage="avatar"
            recommended="512 × 512"
            @update:model-value="config.avatarMediaId = $event; ensureAvatarPreview()"
          />
        </div>
      </div>

      <!-- social links -->
      <div class="rounded-xl border p-5">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold">
            {{ t('res.authorcard.social') }}
          </h2>
          <UiButton
            size="sm"
            variant="outline"
            :disabled="config.socialLinks.length >= 8"
            @click="addSocial"
          >
            + {{ t('res.authorcard.addSocial') }}
          </UiButton>
        </div>
        <p
          v-if="config.socialLinks.length === 0"
          class="text-xs text-muted-foreground"
        >
          {{ t('res.authorcard.noSocial') }}
        </p>
        <div class="space-y-2">
          <div
            v-for="(social, i) in config.socialLinks"
            :key="i"
            class="flex flex-wrap items-center gap-2"
          >
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
              v-model="social.label"
              :placeholder="t('res.authorcard.socialLabel')"
              maxlength="50"
              class="h-9 w-28 rounded-md border bg-background px-3 text-sm"
            >
            <button
              type="button"
              class="h-9 w-9 shrink-0 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
              @click="removeSocial(i)"
            >
              ✕
            </button>
          </div>
        </div>
        <p
          v-if="config.socialLinks.length > 5"
          class="mt-2 text-[10px] text-warning"
        >
          {{ t('res.authorcard.socialLimit') }}
        </p>
      </div>

      <!-- CTA -->
      <div class="rounded-xl border p-5">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold">
            {{ t('res.authorcard.cta') }}
          </h2>
          <label class="flex items-center gap-2 text-sm text-muted-foreground">
            {{ t('res.authorcard.showCta') }}
            <UiSwitch
              :model-value="config.showCta"
              @update:model-value="config.showCta = $event as boolean"
            />
          </label>
        </div>
        <template v-if="config.showCta">
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block space-y-1 text-sm">
              <span class="text-muted-foreground">{{ t('res.authorcard.ctaLabel') }}</span>
              <input
                v-model="config.cta.label"
                maxlength="30"
                :placeholder="t('res.authorcard.ctaPlaceholder')"
                class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
            </label>
            <label class="block space-y-1 text-sm">
              <span class="text-muted-foreground">{{ t('res.authorcard.ctaUrl') }}</span>
              <input
                v-model="config.cta.url"
                placeholder="/about or https://..."
                class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
            </label>
          </div>
          <label class="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <input
              v-model="config.cta!.target"
              type="radio"
              value="self"
              class="h-4 w-4"
            >
            {{ t('res.authorcard.targetSelf') }}
            <input
              v-model="config.cta!.target"
              type="radio"
              value="blank"
              class="ml-3 h-4 w-4"
            >
            {{ t('res.authorcard.targetBlank') }}
          </label>
        </template>
      </div>

      <!-- appearance + display toggles -->
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="rounded-xl border p-5">
          <h2 class="mb-3 text-sm font-semibold">
            {{ t('res.authorcard.appearance') }}
          </h2>
          <label class="mb-2 block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('res.authorcard.layout') }}</span>
            <select
              v-model="config.layout"
              class="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="centered">
                {{ t('res.authorcard.layoutCentered') }}
              </option>
              <option value="compact">
                {{ t('res.authorcard.layoutCompact') }}
              </option>
            </select>
          </label>
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('res.authorcard.avatarStyle') }}</span>
            <select
              v-model="config.avatarStyle"
              class="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="circle">
                {{ t('res.authorcard.styleCircle') }}
              </option>
              <option value="rounded">
                {{ t('res.authorcard.styleRounded') }}
              </option>
            </select>
          </label>
        </div>
        <div class="rounded-xl border p-5">
          <h2 class="mb-3 text-sm font-semibold">
            {{ t('res.authorcard.display') }}
          </h2>
          <div class="space-y-2 text-sm">
            <label class="flex items-center justify-between gap-3">
              {{ t('res.authorcard.showAvatar') }}
              <UiSwitch
                :model-value="config.showAvatar"
                @update:model-value="config.showAvatar = $event as boolean"
              />
            </label>
            <label class="flex items-center justify-between gap-3">
              {{ t('res.authorcard.showHeadline') }}
              <UiSwitch
                :model-value="config.showHeadline"
                @update:model-value="config.showHeadline = $event as boolean"
              />
            </label>
            <label class="flex items-center justify-between gap-3">
              {{ t('res.authorcard.showBio') }}
              <UiSwitch
                :model-value="config.showBio"
                @update:model-value="config.showBio = $event as boolean"
              />
            </label>
            <label class="flex items-center justify-between gap-3">
              {{ t('res.authorcard.showSocials') }}
              <UiSwitch
                :model-value="config.showSocials"
                @update:model-value="config.showSocials = $event as boolean"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
