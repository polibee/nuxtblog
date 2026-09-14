<script setup lang="ts">
import { useI18n } from '~/admin/i18n'
import { resolveAdminDisplayLabel } from '~/admin/i18n/display-label'
import { notify, notifyError } from '~/admin/notifications/notify'
import { RefreshCwIcon, BanIcon, Trash2Icon, PencilIcon } from 'lucide-vue-next'

/* Friend links manager (docs/友链.txt §38/40/41/43): two tabs — live
   links with Check Now, and the submission review queue where the admin
   edits normalized data BEFORE approving (§43). */

defineProps<{ resource: { name: string } }>()

const { t } = useI18n()

interface FriendLink {
  id: number
  name: string
  url: string
  domain: string
  description: string
  status: string
  featured: boolean
  sortOrder: number
  nofollow: boolean
  backlinkStatus: string
  backlinkUrl: string | null
  backlinkFailureCount: number
  backlinkLastCheckedAt: string | null
}
interface Submission {
  id: number
  siteName: string
  siteUrl: string
  domain: string
  description: string
  logoUrl: string | null
  contactEmail: string | null
  backlinkUrl: string | null
  status: string
  backlinkStatus: string
  backlinkFoundUrl: string | null
  siteStatus: string
  siteHttpStatus: number | null
  siteTitleDetected: string | null
  createdAt: string
}

const tab = ref<'links' | 'submissions'>('links')
const statusFilter = ref('active')
const links = ref<FriendLink[]>([])
const submissions = ref<Submission[]>([])
const loading = ref(false)
const checking = ref<number | null>(null)

/* edit dialog state (§40) */
const editing = ref<FriendLink | null>(null)
const editForm = reactive({ name: '', url: '', description: '', featured: false, sortOrder: 0, nofollow: false, status: 'active', backlinkUrl: '' })

/* review edit state (§43) */
const reviewing = ref<Submission | null>(null)
const reviewForm = reactive({ siteName: '', siteUrl: '', description: '', logoUrl: '', featured: false, nofollow: false })

async function load(): Promise<void> {
  loading.value = true
  try {
    const [linkRes, subRes] = await Promise.all([
      $fetch<{ items: FriendLink[] }>('/api/admin/friend-links', { query: { status: statusFilter.value === 'all' ? undefined : statusFilter.value } }),
      $fetch<{ items: Submission[] }>('/api/admin/friend-links/submissions')
    ])
    links.value = linkRes.items ?? []
    submissions.value = (subRes.items ?? []).filter(s => ['pending', 'reviewing'].includes(s.status))
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch([tab, statusFilter], () => void load())

async function checkNow(link: FriendLink): Promise<void> {
  checking.value = link.id
  try {
    await $fetch(`/api/admin/friend-links/${link.id}/check`, { method: 'POST' })
    notify(t('res.friendlinks.checked'))
    await load()
  } catch (e) {
    notifyError(t('res.friendlinks.checkFailed'), (e as Error).message)
  } finally {
    checking.value = null
  }
}

function openEdit(link: FriendLink): void {
  editing.value = link
  Object.assign(editForm, {
    name: link.name, url: link.url, description: link.description,
    featured: link.featured, sortOrder: link.sortOrder, nofollow: link.nofollow,
    status: link.status, backlinkUrl: link.backlinkUrl ?? ''
  })
}

async function saveEdit(): Promise<void> {
  if (!editing.value) return
  try {
    await $fetch(`/api/admin/friend-links/${editing.value.id}`, { method: 'PUT', body: { ...editForm } })
    notify(t('res.friendlinks.saved'))
    editing.value = null
    await load()
  } catch (e) {
    notifyError(t('res.friendlinks.saveFailed'), (e as Error).message)
  }
}

async function disableLink(link: FriendLink): Promise<void> {
  await $fetch(`/api/admin/friend-links/${link.id}`, { method: 'PUT', body: { status: 'disabled' } })
  await load()
}

async function removeLink(link: FriendLink): Promise<void> {
  if (!window.confirm(t('res.friendlinks.removeConfirm'))) return
  await $fetch(`/api/admin/friend-links/${link.id}`, { method: 'DELETE' })
  await load()
}

function openReview(submission: Submission): void {
  reviewing.value = submission
  Object.assign(reviewForm, {
    siteName: submission.siteName, siteUrl: submission.siteUrl, description: submission.description,
    logoUrl: submission.logoUrl ?? '', featured: false, nofollow: false
  })
}

async function approve(): Promise<void> {
  if (!reviewing.value) return
  try {
    await $fetch(`/api/admin/friend-links/submissions/${reviewing.value.id}/approve`, { method: 'POST', body: { ...reviewForm } })
    notify(t('res.friendlinks.approved'))
    reviewing.value = null
    await load()
  } catch (e) {
    notifyError(t('res.friendlinks.saveFailed'), (e as Error).message)
  }
}

async function reject(spam: boolean): Promise<void> {
  if (!reviewing.value) return
  await $fetch(`/api/admin/friend-links/submissions/${reviewing.value.id}/reject`, {
    method: 'POST',
    body: { action: spam ? 'spam' : 'reject' }
  })
  reviewing.value = null
  await load()
}

function backlinkBadgeClass(status: string): string {
  if (status === 'found') return 'text-primary'
  if (status === 'not_found') return 'text-destructive'
  return 'text-muted-foreground'
}
</script>

<template>
  <div class="space-y-5">
    <div class="grid gap-3 sm:grid-cols-3">
      <div class="rounded-2xl border bg-card p-4">
        <p class="text-xs text-muted-foreground">
          {{ t('res.friendlinks.statActive') }}
        </p>
        <p class="mt-1 text-2xl font-semibold">
          {{ links.filter(link => link.status === 'active').length }}
        </p>
      </div>
      <div class="rounded-2xl border bg-card p-4">
        <p class="text-xs text-muted-foreground">
          {{ t('res.friendlinks.statVerified') }}
        </p>
        <p class="mt-1 text-2xl font-semibold">
          {{ links.filter(link => link.backlinkStatus === 'found').length }}
        </p>
      </div>
      <div class="rounded-2xl border bg-card p-4">
        <p class="text-xs text-muted-foreground">
          {{ t('res.friendlinks.statPending') }}
        </p>
        <p class="mt-1 text-2xl font-semibold">
          {{ submissions.length }}
        </p>
      </div>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex gap-1 rounded-lg border p-1 text-sm">
        <button
          type="button"
          class="rounded-md px-3 py-1.5"
          :class="tab === 'links' ? 'bg-accent font-medium' : 'text-muted-foreground'"
          @click="tab = 'links'"
        >
          {{ t('res.friendlinks.tabLinks') }}
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1.5"
          :class="tab === 'submissions' ? 'bg-accent font-medium' : 'text-muted-foreground'"
          @click="tab = 'submissions'"
        >
          {{ t('res.friendlinks.tabSubmissions') }}
          <span
            v-if="submissions.length > 0"
            class="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground"
          >{{ submissions.length }}</span>
        </button>
      </div>
      <select
        v-if="tab === 'links'"
        v-model="statusFilter"
        class="h-9 rounded-md border bg-background px-2 text-sm"
      >
        <option value="active">
          {{ t('res.friendlinks.statusActive') }}
        </option>
        <option value="disabled">
          {{ t('res.friendlinks.statusDisabled') }}
        </option>
        <option value="broken">
          {{ t('res.friendlinks.statusBroken') }}
        </option>
        <option value="all">
          {{ t('res.friendlinks.statusAll') }}
        </option>
      </select>
    </div>

    <!-- links tab (§38/39) -->
    <div
      v-if="tab === 'links'"
      class="overflow-x-auto rounded-2xl border"
    >
      <div class="grid gap-3 p-3 md:hidden">
        <article
          v-for="link in links"
          :key="`card-${link.id}`"
          class="rounded-xl border bg-card p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-medium">
                {{ link.name }} <span
                  v-if="link.featured"
                  class="text-primary"
                >★</span>
              </p>
              <p class="truncate text-xs text-muted-foreground">
                {{ link.domain }}
              </p>
            </div>
            <span
              class="shrink-0 text-xs"
              :class="backlinkBadgeClass(link.backlinkStatus)"
            >{{ resolveAdminDisplayLabel(t, 'friendBacklinkStatus', link.backlinkStatus) }}</span>
          </div>
          <p class="mt-3 line-clamp-2 text-sm text-muted-foreground">
            {{ link.description || '—' }}
          </p>
          <div class="mt-4 flex justify-end gap-2">
            <button
              type="button"
              class="h-8 rounded-md border px-3 text-xs"
              @click="openEdit(link)"
            >
              {{ t('common.edit') }}
            </button>
            <button
              type="button"
              class="h-8 rounded-md border border-destructive/40 px-3 text-xs text-destructive"
              @click="removeLink(link)"
            >
              {{ t('common.delete') }}
            </button>
          </div>
        </article>
        <p
          v-if="links.length === 0"
          class="p-8 text-center text-sm text-muted-foreground"
        >
          {{ t('res.friendlinks.noLinks') }}
        </p>
      </div>
      <table class="hidden w-full text-sm md:table">
        <thead class="border-b bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-4 py-2.5">
              {{ t('res.friendlinks.colName') }}
            </th>
            <th class="px-4 py-2.5">
              {{ t('res.friendlinks.colBacklink') }}
            </th>
            <th class="px-4 py-2.5">
              {{ t('res.friendlinks.colLastCheck') }}
            </th>
            <th class="px-4 py-2.5 text-right">
              {{ t('res.friendlinks.colActions') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="link in links"
            :key="link.id"
            class="border-b last:border-b-0"
          >
            <td class="px-4 py-3">
              <p class="font-medium">
                {{ link.name }}
                <span
                  v-if="link.featured"
                  class="text-primary"
                >★</span>
                <span
                  v-if="link.status !== 'active'"
                  class="ml-1 text-xs text-muted-foreground"
                >({{ link.status }})</span>
              </p>
              <p class="text-xs text-muted-foreground">
                {{ link.domain }}
              </p>
            </td>
            <td class="px-4 py-3">
              <span :class="backlinkBadgeClass(link.backlinkStatus)">
                {{ resolveAdminDisplayLabel(t, 'friendBacklinkStatus', link.backlinkStatus) }}
                <span v-if="link.backlinkFailureCount > 0">×{{ link.backlinkFailureCount }}</span>
              </span>
            </td>
            <td class="px-4 py-3 text-xs text-muted-foreground">
              {{ link.backlinkLastCheckedAt ? new Date(link.backlinkLastCheckedAt).toLocaleString() : '—' }}
            </td>
            <td class="px-4 py-3">
              <span class="flex justify-end gap-1">
                <button
                  type="button"
                  class="h-8 w-8 rounded-md border hover:bg-accent disabled:opacity-40"
                  :disabled="checking === link.id"
                  :title="t('res.friendlinks.checkNow')"
                  @click="checkNow(link)"
                >
                  <RefreshCwIcon
                    class="mx-auto h-3.5 w-3.5"
                    :class="checking === link.id ? 'animate-spin' : ''"
                  />
                </button>
                <button
                  type="button"
                  class="h-8 w-8 rounded-md border hover:bg-accent"
                  :title="t('common.edit')"
                  @click="openEdit(link)"
                >
                  <PencilIcon class="mx-auto h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  class="h-8 w-8 rounded-md border hover:bg-accent"
                  :title="t('res.friendlinks.disable')"
                  @click="disableLink(link)"
                >
                  <BanIcon class="mx-auto h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  class="h-8 w-8 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
                  :title="t('common.delete')"
                  @click="removeLink(link)"
                >
                  <Trash2Icon class="mx-auto h-3.5 w-3.5" />
                </button>
              </span>
            </td>
          </tr>
          <tr v-if="links.length === 0">
            <td
              colspan="4"
              class="px-4 py-10 text-center text-muted-foreground"
            >
              {{ t('res.friendlinks.noLinks') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- submissions tab (§41/42/43) -->
    <div
      v-if="tab === 'submissions'"
      class="space-y-3"
    >
      <p
        v-if="submissions.length === 0"
        class="rounded-xl border p-10 text-center text-muted-foreground"
      >
        {{ t('res.friendlinks.noSubmissions') }}
      </p>
      <div
        v-for="submission in submissions"
        :key="submission.id"
        class="rounded-xl border p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium">
              {{ submission.siteName }}
              <span class="text-xs font-normal text-muted-foreground">· {{ submission.domain }}</span>
            </p>
            <p class="mt-0.5 text-sm text-muted-foreground">
              {{ submission.description }}
            </p>
          </div>
          <UiButton
            size="sm"
            variant="outline"
            @click="openReview(submission)"
          >
            {{ t('res.friendlinks.review') }}
          </UiButton>
        </div>
        <!-- §42: automatic checks summary -->
        <div class="mt-2 flex flex-wrap gap-3 text-xs">
          <span :class="submission.siteStatus === 'online' ? 'text-primary' : 'text-muted-foreground'">
            {{ t('res.friendlinks.siteCheck') }}: {{ resolveAdminDisplayLabel(t, 'friendSiteStatus', submission.siteStatus) }}{{ submission.siteHttpStatus ? ` (${submission.siteHttpStatus})` : '' }}
          </span>
          <span :class="backlinkBadgeClass(submission.backlinkStatus)">
            {{ t('res.friendlinks.backlinkCheck') }}: {{ resolveAdminDisplayLabel(t, 'friendBacklinkStatus', submission.backlinkStatus) }}
          </span>
          <span
            v-if="submission.backlinkFoundUrl"
            class="truncate font-mono text-muted-foreground"
          >{{ submission.backlinkFoundUrl }}</span>
        </div>
      </div>
    </div>

    <!-- edit dialog (§40) -->
    <Teleport to="body">
      <div
        v-if="editing"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="editing = null"
      >
        <div class="w-full max-w-lg space-y-3 rounded-xl border bg-card p-5">
          <h2 class="text-sm font-semibold">
            {{ t('res.friendlinks.editTitle') }}
          </h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block space-y-1 text-sm">
              <span class="text-muted-foreground">{{ t('res.friendlinks.formName') }} *</span>
              <input
                v-model="editForm.name"
                class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
            </label>
            <label class="block space-y-1 text-sm">
              <span class="text-muted-foreground">{{ t('res.friendlinks.formUrl') }} *</span>
              <input
                v-model="editForm.url"
                class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
            </label>
          </div>
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('res.friendlinks.formDescription') }}</span>
            <textarea
              v-model="editForm.description"
              rows="2"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('res.friendlinks.backlinkUrlField') }}</span>
            <input
              v-model="editForm.backlinkUrl"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
          </label>
          <div class="flex flex-wrap items-center gap-4 text-sm">
            <label class="flex items-center gap-2">
              <input
                v-model="editForm.featured"
                type="checkbox"
              >{{ t('res.friendlinks.featured') }}
            </label>
            <label class="flex items-center gap-2">
              <input
                v-model="editForm.nofollow"
                type="checkbox"
              >nofollow
            </label>
            <label class="flex items-center gap-2">
              <span class="text-muted-foreground">{{ t('res.friendlinks.sort') }}</span>
              <input
                v-model.number="editForm.sortOrder"
                type="number"
                class="h-8 w-20 rounded-md border bg-background px-2 text-sm"
              >
            </label>
          </div>
          <div class="flex justify-end gap-2">
            <UiButton
              variant="ghost"
              @click="editing = null"
            >
              {{ t('common.cancel') }}
            </UiButton>
            <UiButton @click="saveEdit">
              {{ t('common.save') }}
            </UiButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- review dialog (§42/43): edit & approve / reject / spam -->
    <Teleport to="body">
      <div
        v-if="reviewing"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="reviewing = null"
      >
        <div class="max-h-[90vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-xl border bg-card p-5">
          <h2 class="text-sm font-semibold">
            {{ t('res.friendlinks.reviewTitle') }}
          </h2>
          <p class="text-xs text-muted-foreground">
            {{ t('res.friendlinks.reviewHint') }}
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block space-y-1 text-sm">
              <span class="text-muted-foreground">{{ t('res.friendlinks.formName') }} *</span>
              <input
                v-model="reviewForm.siteName"
                class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
            </label>
            <label class="block space-y-1 text-sm">
              <span class="text-muted-foreground">{{ t('res.friendlinks.formUrl') }} *</span>
              <input
                v-model="reviewForm.siteUrl"
                class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
            </label>
          </div>
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('res.friendlinks.formDescription') }}</span>
            <textarea
              v-model="reviewForm.description"
              rows="2"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('res.friendlinks.formLogo') }}</span>
            <input
              v-model="reviewForm.logoUrl"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
          </label>
          <div class="flex flex-wrap items-center gap-4 text-sm">
            <label class="flex items-center gap-2">
              <input
                v-model="reviewForm.featured"
                type="checkbox"
              >{{ t('res.friendlinks.featured') }}
            </label>
            <label class="flex items-center gap-2">
              <input
                v-model="reviewForm.nofollow"
                type="checkbox"
              >nofollow
            </label>
          </div>
          <div class="flex flex-wrap justify-end gap-2 border-t pt-3">
            <UiButton
              size="sm"
              variant="ghost"
              class="text-destructive"
              @click="reject(false)"
            >
              {{ t('res.friendlinks.reject') }}
            </UiButton>
            <UiButton
              size="sm"
              variant="ghost"
              class="text-destructive"
              @click="reject(true)"
            >
              {{ t('res.friendlinks.spam') }}
            </UiButton>
            <UiButton
              size="sm"
              @click="approve"
            >
              {{ t('res.friendlinks.approve') }}
            </UiButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
