<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <header class="space-y-2 text-center">
      <h1 class="text-2xl font-bold tracking-tight">
        {{ t('public.adapply.title') }}
      </h1>
      <p class="text-sm text-muted-foreground">
        {{ t('public.adapply.subtitle') }}
      </p>
    </header>

    <div
      v-if="!enabled"
      class="rounded-xl border p-8 text-center text-sm text-muted-foreground"
    >
      {{ t('public.adapply.disabled') }}
    </div>

    <form
      v-else
      class="space-y-4 rounded-xl border p-5"
      @submit.prevent="submit"
    >
      <label class="block space-y-1 text-sm">
        <span class="text-muted-foreground">{{ t('public.adapply.bannerTitle') }}</span>
        <input
          v-model="form.materialTitle"
          required
          maxlength="200"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
      </label>
      <label class="block space-y-1 text-sm">
        <span class="text-muted-foreground">{{ t('public.adapply.bannerDescription') }}</span>
        <textarea
          v-model="form.materialDescription"
          maxlength="500"
          rows="2"
          class="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label class="block space-y-1 text-sm">
        <span class="text-muted-foreground">{{ t('public.adapply.targetUrl') }}</span>
        <input
          v-model="form.materialUrl"
          required
          type="url"
          placeholder="https://..."
          class="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
      </label>
      <fieldset class="space-y-2">
        <legend class="text-sm text-muted-foreground">
          {{ t('public.adapply.slot') }}
        </legend>
        <div class="grid gap-2 sm:grid-cols-2">
          <button
            v-for="slot in slots"
            :key="slot.key"
            type="button"
            class="rounded-lg border px-3 py-3 text-left text-sm transition-colors"
            :class="form.materialSlotKey === slot.key ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent'"
            @click="form.materialSlotKey = slot.key"
          >
            <span class="block font-medium">{{ slot.name }}</span>
            <span class="mt-1 block text-xs text-muted-foreground">{{ slot.key }}</span>
          </button>
        </div>
      </fieldset>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('public.adapply.duration') }}</span>
          <input
            v-model.number="billingUnits"
            required
            type="number"
            min="1"
            max="365"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
          <span class="text-xs text-muted-foreground">
            {{ selectedSlot ? `${t('public.adapply.price')}: ${selectedSlot.priceMinor / 100} ${selectedSlot.currency} / ${selectedSlot.billingUnit === 'month' ? t('public.adapply.month') : t('public.adapply.day')}` : '' }}
          </span>
        </label>
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('public.adapply.budget') }} (USD)</span>
          <input
            v-model="budgetDisplay"
            required
            type="number"
            step="0.01"
            :min="minimumBudgetMinor / 100 || 1"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
        </label>
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('public.adapply.email') }}</span>
          <input
            v-model="form.contactEmail"
            required
            type="email"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
        </label>
      </div>
      <label class="block space-y-1 text-sm">
        <span class="text-muted-foreground">{{ t('public.adapply.image') }}</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          class="block w-full text-sm"
          @change="onUpload"
        >
        <img
          v-if="imagePreview"
          :src="imagePreview"
          :alt="t('public.adapply.image')"
          class="mt-2 aspect-[16/7] w-full rounded-md border object-cover"
        >
      </label>

      <p
        v-if="error"
        class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ error }}
      </p>

      <button
        type="submit"
        class="h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        :disabled="submitting"
      >
        {{ submitting ? t('common.saving') : t('public.adapply.submit') }}
      </button>
      <p class="text-center text-xs text-muted-foreground">
        {{ t('public.adapply.reviewHint') }}
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'public' })

const { t } = useI18n()
const { localeCode } = useLocale()

interface SlotOption { key: string, name: string, billingUnit: 'day' | 'month', priceMinor: number, currency: string }

const enabled = ref(false)
const slots = ref<SlotOption[]>([])
const submitting = ref(false)
const error = ref('')
const imagePreview = ref('')
const imageId = ref(0)
const budgetDisplay = ref('50')
const billingUnits = ref(1)
const uploading = ref(false)

const form = reactive({
  materialTitle: '',
  materialDescription: '',
  materialUrl: '',
  materialSlotKey: '',
  contactEmail: ''
})

const { data: enabledData } = await useFetch<{ enabled: boolean }>(
  '/api/public/advertising/purchase-enabled',
  { key: `ad-apply-enabled-${localeCode.value}` }
)
enabled.value = enabledData.value?.enabled ?? false

const { data: slotData } = await useFetch<{ slots: SlotOption[] }>(
  '/api/public/advertising/slots',
  { key: `ad-apply-slots-${localeCode.value}` }
)
slots.value = slotData.value?.slots ?? []
form.materialSlotKey = slots.value[0]?.key ?? ''

const selectedSlot = computed(() => slots.value.find(slot => slot.key === form.materialSlotKey))
const minimumBudgetMinor = computed(() => (selectedSlot.value?.priceMinor ?? 0) * billingUnits.value)
watch([() => form.materialSlotKey, billingUnits], () => {
  const minimum = minimumBudgetMinor.value / 100
  if (minimum > Number(budgetDisplay.value || 0)) budgetDisplay.value = minimum.toFixed(2)
})

async function onUpload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  error.value = ''
  try {
    const body = new FormData()
    body.append('file', file)
    const res = await $fetch<{ id: number, url: string }>('/api/public/advertising/upload', { method: 'POST', body })
    imageId.value = res.id
    imagePreview.value = res.url
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function submit(): Promise<void> {
  submitting.value = true
  error.value = ''
  try {
    const res = await $fetch<{ orderNumber: string }>('/api/public/advertising/apply', {
      method: 'POST',
      body: {
        ...form,
        materialImageMediaId: imageId.value,
        budgetMinor: Math.round(Number(budgetDisplay.value) * 100),
        billingUnit: selectedSlot.value?.billingUnit ?? 'day',
        billingUnits: billingUnits.value
      }
    })
    await navigateTo(`/checkout/${res.orderNumber}`)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    submitting.value = false
  }
}

useSeoMeta({
  title: () => t('public.adapply.title'),
  robots: 'noindex, nofollow'
})
</script>
