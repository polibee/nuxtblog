<script setup lang="ts">
import { UserPlusIcon } from 'lucide-vue-next'

definePageMeta({ layout: false })
const { t } = useI18n()
const email = ref('')
const name = ref('')
const password = ref('')
const confirmation = ref('')
const agreed = ref(false)
const loading = ref(false)
const error = ref('')

function errorMessage(error: unknown): string {
  const status = (error as { statusCode?: number, data?: { statusCode?: number } })?.statusCode ?? (error as { data?: { statusCode?: number } })?.data?.statusCode
  if (status === 409) return t('auth.register.duplicate')
  if (status === 429) return t('auth.register.rateLimited')
  if (status === 422) return t('auth.register.invalid')
  return t('auth.register.failed')
}

async function submit(): Promise<void> {
  error.value = ''
  if (password.value !== confirmation.value) {
    error.value = t('auth.register.mismatch')
    return
  }
  if (!agreed.value) {
    error.value = t('auth.register.agreementRequired')
    return
  }
  loading.value = true
  try {
    await $fetch('/api/auth/register', { method: 'POST', body: { email: email.value, name: name.value, password: password.value } })
    await navigateTo('/account', { replace: true })
  } catch (e: unknown) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-muted/40 p-4 dark:bg-background">
    <UiCard class="w-full max-w-sm space-y-5 p-6">
      <div class="space-y-2 text-center">
        <UserPlusIcon class="mx-auto h-8 w-8 text-primary" />
        <h1 class="text-xl font-semibold">
          {{ t('auth.register.title') }}
        </h1>
      </div>
      <form class="space-y-4" @submit.prevent="submit">
        <UiInput v-model="email" type="email" :placeholder="t('auth.email')" required />
        <UiInput v-model="name" :placeholder="t('auth.register.name')" maxlength="80" required />
        <UiInput v-model="password" type="password" :placeholder="t('auth.password')" minlength="8" required />
        <UiInput v-model="confirmation" type="password" :placeholder="t('auth.register.confirm')" minlength="8" required />
        <label class="flex items-start gap-2 text-xs text-muted-foreground"><input v-model="agreed" type="checkbox" required><span>{{ t('auth.register.agreement') }}</span></label>
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
          {{ loading ? t('auth.register.submitting') : t('auth.register.submit') }}
        </UiButton>
      </form>
      <NuxtLink
        to="/login"
        class="block text-center text-xs text-muted-foreground"
      >
        {{ t('auth.backToSignIn') }}
      </NuxtLink>
    </UiCard>
  </div>
</template>
