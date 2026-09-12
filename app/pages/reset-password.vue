<script setup lang="ts">
import { CheckCircleIcon, KeyRoundIcon } from 'lucide-vue-next'

definePageMeta({ layout: false })

const route = useRoute()
const { t } = useI18n()

const token = computed(() =>
  typeof route.query.token === 'string' && route.query.token.length > 0 ? route.query.token : ''
)

const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const loading = ref(false)
const error = ref('')
const done = ref(false)

async function requestReset(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/password-reset/request', {
      method: 'POST',
      body: { email: email.value }
    })
    done.value = true
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? t('auth.reset.failed')
  } finally {
    loading.value = false
  }
}

async function confirmReset(): Promise<void> {
  if (password.value !== passwordConfirm.value) {
    error.value = t('auth.reset.mismatch')
    return
  }
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/password-reset/confirm', {
      method: 'POST',
      body: { token: token.value, password: password.value }
    })
    done.value = true
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? t('auth.reset.failed')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-muted/40 p-4 dark:bg-background">
    <div class="w-full max-w-sm space-y-6">
      <div class="space-y-2 text-center">
        <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <KeyRoundIcon class="h-5 w-5" />
        </div>
        <h1 class="text-xl font-semibold">
          {{ t('auth.reset.title') }}
        </h1>
      </div>

      <UiCard
        v-if="done"
        class="space-y-3 p-6 text-center"
      >
        <CheckCircleIcon class="mx-auto h-8 w-8 text-[var(--success)]" />
        <p class="text-sm text-muted-foreground">
          {{ token ? t('auth.reset.done') : t('auth.reset.requested') }}
        </p>
        <UiButton
          to="/login"
          variant="outline"
          class="w-full"
        >
          {{ t('auth.backToSignIn') }}
        </UiButton>
      </UiCard>

      <UiCard
        v-else-if="token"
        class="p-6"
      >
        <form
          class="space-y-4"
          @submit.prevent="confirmReset"
        >
          <div class="space-y-1.5">
            <UiLabel for="password">
              {{ t('auth.reset.newPassword') }}
            </UiLabel>
            <UiInput
              id="password"
              v-model="password"
              type="password"
              minlength="8"
              required
            />
          </div>
          <div class="space-y-1.5">
            <UiLabel for="confirm">
              {{ t('auth.reset.confirmPassword') }}
            </UiLabel>
            <UiInput
              id="confirm"
              v-model="passwordConfirm"
              type="password"
              minlength="8"
              required
            />
          </div>

          <p
            v-if="error"
            class="text-xs text-destructive"
          >
            {{ error }}
          </p>

          <UiButton
            type="submit"
            class="w-full"
            :disabled="loading"
          >
            {{ t('auth.reset.submit') }}
          </UiButton>
        </form>
      </UiCard>

      <UiCard
        v-else
        class="p-6"
      >
        <form
          class="space-y-4"
          @submit.prevent="requestReset"
        >
          <div class="space-y-1.5">
            <UiLabel for="email">
              {{ t('auth.email') }}
            </UiLabel>
            <UiInput
              id="email"
              v-model="email"
              type="email"
              required
            />
            <p class="text-xs text-muted-foreground">
              {{ t('auth.reset.hint') }}
            </p>
          </div>

          <p
            v-if="error"
            class="text-xs text-destructive"
          >
            {{ error }}
          </p>

          <UiButton
            type="submit"
            class="w-full"
            :disabled="loading"
          >
            {{ t('auth.reset.send') }}
          </UiButton>
        </form>
      </UiCard>

      <p class="text-center text-xs text-muted-foreground">
        <NuxtLink
          to="/login"
          class="transition-colors hover:text-foreground"
        >
          {{ t('auth.backToSignIn') }}
        </NuxtLink>
      </p>
    </div>
  </div>
</template>
