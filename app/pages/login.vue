<script setup lang="ts">
import { EyeIcon, EyeOffIcon, LogInIcon } from 'lucide-vue-next'

definePageMeta({ layout: false })

const auth = useAuthStore()
const route = useRoute()
const { t } = useI18n()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

async function submit(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    await auth.login(email.value, password.value)
    const target = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    // only allow in-app relative redirects (open-redirect guard)
    const safe = target.startsWith('/') && !target.startsWith('//') ? target : '/admin'
    await navigateTo(safe, { replace: true })
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? t('auth.invalid')
  } finally {
    loading.value = false
  }
}

/* dev-only seed credentials hint (endpoint 404s in production builds) */
const devCredentials = ref<{ email: string, password: string } | null>(null)

onMounted(async () => {
  try {
    const fetchJson = $fetch as unknown as (url: string) => Promise<{ email: string, password: string }>
    devCredentials.value = await fetchJson('/api/auth/dev-credentials')
  } catch {
    devCredentials.value = null
  }
})

function fillDev(): void {
  if (!devCredentials.value) return
  email.value = devCredentials.value.email
  password.value = devCredentials.value.password
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-muted/40 p-4 dark:bg-background">
    <div class="w-full max-w-sm space-y-6">
      <div class="space-y-2 text-center">
        <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <svg
            viewBox="0 0 24 24"
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path
              d="M4 17l6-6-6-6M12 19h8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <h1 class="text-xl font-semibold">
          {{ t('auth.title') }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ t('auth.subtitle') }}
        </p>
      </div>

      <UiCard class="p-6">
        <form
          class="space-y-4"
          @submit.prevent="submit"
        >
          <div class="space-y-1.5">
            <UiLabel for="email">
              {{ t('auth.email') }}
            </UiLabel>
            <UiInput
              id="email"
              v-model="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <div class="space-y-1.5">
            <UiLabel for="password">
              {{ t('auth.password') }}
            </UiLabel>
            <div class="relative">
              <UiInput
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                required
                class="pr-9"
              />
              <button
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                @click="showPassword = !showPassword"
              >
                <EyeIcon
                  v-if="showPassword"
                  class="h-4 w-4"
                />
                <EyeOffIcon
                  v-else
                  class="h-4 w-4"
                />
              </button>
            </div>
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
            <LogInIcon /> {{ loading ? t('auth.signingIn') : t('auth.signIn') }}
          </UiButton>
        </form>
      </UiCard>

      <UiCard
        v-if="devCredentials"
        class="space-y-2 border-dashed p-4"
      >
        <p class="text-xs font-medium text-muted-foreground">
          {{ t('auth.devHint') }}
        </p>
        <div class="grid gap-1 text-xs">
          <button
            class="flex justify-between rounded px-2 py-1 hover:bg-accent"
            type="button"
            @click="fillDev"
          >
            <span>{{ devCredentials.email }}</span>
            <span class="font-mono text-muted-foreground">{{ devCredentials.password }}</span>
          </button>
        </div>
      </UiCard>

      <p class="text-center text-xs text-muted-foreground">
        <NuxtLink
          to="/reset-password"
          class="transition-colors hover:text-foreground"
        >
          {{ t('auth.forgotPassword') }}
        </NuxtLink>
      </p>
    </div>
  </div>
</template>
