<script setup lang="ts">
import { LockKeyholeIcon, UserCircleIcon } from 'lucide-vue-next'

definePageMeta({ layout: 'public' })

interface AccountProfile {
  userId: number
  name: string
  email: string
  websiteUrl: string | null
  bio: string
  avatarUrl: string | null
  locale: string
  timezone: string
}

interface AccountActivity {
  orders: Array<{ id: number, orderNumber: string, status: string, paymentStatus: string, totalMinor: number, currency: string, createdAt: string }>
  payments: Array<{ id: number, orderNumber: string, gatewayKey: string, status: string, amountMinor: number, currency: string, createdAt: string }>
  comments: Array<{ id: number, postId: number, content: string, status: string, createdAt: string }>
  advertising: Array<{ id: number, name: string, status: string, budgetMinor: number, currency: string, orderNumber: string | null, createdAt: string }>
  exports: Array<{ id: number, type: string, status: string, rowCount: number, createdAt: string, completedAt: string | null }>
}

const { t } = useI18n()
const route = useRoute()
const activeTab = ref<'overview' | 'profile' | 'security'>('overview')
const { data: profile, error, pending } = await useFetch<AccountProfile>('/api/auth/profile')
const { data: activity } = await useFetch<AccountActivity>('/api/auth/activity', { lazy: true })
const name = ref('')
const websiteUrl = ref('')
const bio = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const message = ref('')
const errorMessage = ref('')
const savingProfile = ref(false)
const savingPassword = ref(false)
const activityView = computed(() => {
  const value = String(route.query.view ?? 'overview')
  return ['overview', 'orders', 'payments', 'comments', 'advertising', 'exports'].includes(value) ? value : 'overview'
})

function money(minor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100)
}

function exportActivity(): void {
  window.open('/api/auth/activity/export', '_blank', 'noopener,noreferrer')
}

function requestError(error: unknown): string {
  const status = (error as { statusCode?: number, data?: { statusCode?: number } })?.statusCode ?? (error as { data?: { statusCode?: number } })?.data?.statusCode
  return status === 422 ? t('auth.account.invalid') : t('auth.account.saveFailed')
}

watch(profile, (value) => {
  if (value) {
    name.value = value.name
    websiteUrl.value = value.websiteUrl ?? ''
    bio.value = value.bio
  }
}, { immediate: true })

async function saveProfile(): Promise<void> {
  savingProfile.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    const saved = await $fetch<AccountProfile>('/api/auth/profile', {
      method: 'PUT',
      body: { name: name.value, websiteUrl: websiteUrl.value || null, bio: bio.value }
    })
    profile.value = saved
    name.value = saved.name
    websiteUrl.value = saved.websiteUrl ?? ''
    bio.value = saved.bio
    message.value = t('auth.account.saved')
  } catch (error: unknown) {
    errorMessage.value = requestError(error)
  } finally {
    savingProfile.value = false
  }
}

async function savePassword(): Promise<void> {
  savingPassword.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: currentPassword.value, newPassword: newPassword.value }
    })
    message.value = t('auth.account.passwordChanged')
    currentPassword.value = ''
    newPassword.value = ''
  } catch (error: unknown) {
    errorMessage.value = requestError(error)
  } finally {
    savingPassword.value = false
  }
}
</script>

<template>
  <main class="mx-auto max-w-3xl space-y-6 p-6">
    <p
      v-if="pending"
      class="text-sm text-muted-foreground"
      role="status"
    >
      {{ t('auth.account.loading') }}
    </p>
    <UiEmpty v-if="error">
      <template #title>
        {{ t('auth.account.loadFailed') }}
      </template>
    </UiEmpty>
    <template v-else-if="profile">
      <div>
        <h1 class="text-2xl font-semibold">
          {{ t('auth.account.title') }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ profile.email }}
        </p>
      </div>
      <nav
        class="flex flex-wrap gap-2 rounded-xl border bg-muted/20 p-2"
        :aria-label="t('auth.account.menu.title')"
      >
        <NuxtLink
          v-for="item in [
            ['overview', 'auth.account.menu.overview'],
            ['orders', 'auth.account.menu.orders'],
            ['payments', 'auth.account.menu.payments'],
            ['comments', 'auth.account.menu.comments'],
            ['advertising', 'auth.account.menu.advertising'],
            ['exports', 'auth.account.menu.exports']
          ]"
          :key="item[0]"
          :to="item[0] === 'overview' ? '/account' : `/account?view=${item[0]}`"
          class="rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
          :class="activityView === item[0] ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'"
        >
          {{ t(item[1]) }}
        </NuxtLink>
      </nav>
      <UiCard
        v-if="activity && activityView === 'overview'"
        class="grid gap-3 p-5 sm:grid-cols-4"
      >
        <div>
          <p class="text-2xl font-semibold">
            {{ activity.orders.length }}
          </p><p class="text-xs text-muted-foreground">
            {{ t('auth.account.menu.orders') }}
          </p>
        </div>
        <div>
          <p class="text-2xl font-semibold">
            {{ activity.payments.length }}
          </p><p class="text-xs text-muted-foreground">
            {{ t('auth.account.menu.payments') }}
          </p>
        </div>
        <div>
          <p class="text-2xl font-semibold">
            {{ activity.comments.length }}
          </p><p class="text-xs text-muted-foreground">
            {{ t('auth.account.menu.comments') }}
          </p>
        </div>
        <div>
          <p class="text-2xl font-semibold">
            {{ activity.advertising.length }}
          </p><p class="text-xs text-muted-foreground">
            {{ t('auth.account.menu.advertising') }}
          </p>
        </div>
      </UiCard>
      <UiCard
        v-if="activity && activityView !== 'overview'"
        class="space-y-3 p-5"
      >
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-medium">
            {{ t(`auth.account.menu.${activityView}`) }}
          </h2>
          <UiButton
            v-if="activityView !== 'exports'"
            variant="outline"
            size="sm"
            @click="exportActivity"
          >
            {{ t('auth.account.export') }}
          </UiButton>
        </div>
        <div
          v-if="activityView === 'orders'"
          class="divide-y text-sm"
        >
          <div
            v-for="item in activity.orders"
            :key="item.id"
            class="flex justify-between gap-4 py-3"
          >
            <span>{{ item.orderNumber }} · {{ item.status }}</span><span>{{ money(item.totalMinor, item.currency) }}</span>
          </div>
          <p
            v-if="!activity.orders.length"
            class="py-3 text-muted-foreground"
          >
            {{ t('auth.account.empty') }}
          </p>
        </div>
        <div
          v-else-if="activityView === 'payments'"
          class="divide-y text-sm"
        >
          <div
            v-for="item in activity.payments"
            :key="item.id"
            class="flex justify-between gap-4 py-3"
          >
            <span>{{ item.orderNumber }} · {{ item.gatewayKey }} · {{ item.status }}</span><span>{{ money(item.amountMinor, item.currency) }}</span>
          </div>
          <p
            v-if="!activity.payments.length"
            class="py-3 text-muted-foreground"
          >
            {{ t('auth.account.empty') }}
          </p>
        </div>
        <div
          v-else-if="activityView === 'comments'"
          class="divide-y text-sm"
        >
          <div
            v-for="item in activity.comments"
            :key="item.id"
            class="py-3"
          >
            <p class="line-clamp-2">
              {{ item.content }}
            </p><p class="mt-1 text-xs text-muted-foreground">
              #{{ item.postId }} · {{ item.status }}
            </p>
          </div>
          <p
            v-if="!activity.comments.length"
            class="py-3 text-muted-foreground"
          >
            {{ t('auth.account.empty') }}
          </p>
        </div>
        <div
          v-else-if="activityView === 'advertising'"
          class="divide-y text-sm"
        >
          <div
            v-for="item in activity.advertising"
            :key="item.id"
            class="flex justify-between gap-4 py-3"
          >
            <span>{{ item.name }} · {{ item.status }}</span><span>{{ money(item.budgetMinor, item.currency) }}</span>
          </div>
          <p
            v-if="!activity.advertising.length"
            class="py-3 text-muted-foreground"
          >
            {{ t('auth.account.empty') }}
          </p>
        </div>
        <div
          v-else
          class="divide-y text-sm"
        >
          <div
            v-for="item in activity.exports"
            :key="item.id"
            class="flex justify-between gap-4 py-3"
          >
            <span>{{ item.type }} · {{ item.status }}</span><span>{{ item.rowCount }}</span>
          </div>
          <p
            v-if="!activity.exports.length"
            class="py-3 text-muted-foreground"
          >
            {{ t('auth.account.empty') }}
          </p>
        </div>
      </UiCard>
      <nav class="flex gap-2 border-b">
        <button
          v-for="tab in (['overview', 'profile', 'security'] as const)"
          :key="tab"
          class="border-b-2 px-3 py-2 text-sm"
          :class="activeTab === tab ? 'border-primary' : 'border-transparent text-muted-foreground'"
          @click="activeTab = tab"
        >
          {{ t(`auth.account.tab.${tab}`) }}
        </button>
      </nav>
      <UiCard
        v-if="activeTab === 'overview'"
        class="space-y-3 p-5"
      >
        <UserCircleIcon class="h-8 w-8 text-primary" />
        <p class="text-lg font-medium">
          {{ profile.name }}
        </p>
        <p class="whitespace-pre-line text-sm text-muted-foreground">
          {{ profile.bio || t('auth.account.noBio') }}
        </p>
        <a
          v-if="profile.websiteUrl"
          :href="profile.websiteUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-primary"
        >
          {{ profile.websiteUrl }}
        </a>
      </UiCard>
      <UiCard
        v-else-if="activeTab === 'profile'"
        class="space-y-4 p-5"
      >
        <UiInput
          v-model="name"
          :placeholder="t('auth.register.name')"
        />
        <UiInput
          v-model="websiteUrl"
          type="url"
          placeholder="https://example.com"
        />
        <textarea
          v-model="bio"
          class="min-h-32 w-full rounded-md border bg-background p-3 text-sm"
          :placeholder="t('auth.account.bio')"
          maxlength="10000"
        />
        <UiButton
          :disabled="savingProfile"
          @click="saveProfile"
        >
          {{ t('auth.account.save') }}
        </UiButton>
      </UiCard>
      <UiCard
        v-else
        class="space-y-4 p-5"
      >
        <LockKeyholeIcon class="h-8 w-8 text-primary" />
        <UiInput
          v-model="currentPassword"
          type="password"
          :placeholder="t('auth.account.currentPassword')"
        />
        <UiInput
          v-model="newPassword"
          type="password"
          minlength="8"
          :placeholder="t('auth.reset.newPassword')"
        />
        <UiButton
          :disabled="savingPassword"
          @click="savePassword"
        >
          {{ t('auth.account.changePassword') }}
        </UiButton>
      </UiCard>
      <p
        v-if="message"
        class="text-sm text-[var(--success)]"
      >
        {{ message }}
      </p>
      <p
        v-if="errorMessage"
        class="text-sm text-destructive"
      >
        {{ errorMessage }}
      </p>
    </template>
  </main>
</template>
