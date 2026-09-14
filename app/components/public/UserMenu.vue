<script setup lang="ts">
import {
  ChevronDownIcon,
  CreditCardIcon,
  DownloadIcon,
  LayoutDashboardIcon,
  LogInIcon,
  LogOutIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  ShoppingBagIcon,
  UserCircleIcon
} from 'lucide-vue-next'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'

const auth = useAuthStore()
const { t } = useI18n()

onMounted(() => {
  if (!auth.user) void auth.fetchMe()
})

const isAdmin = computed(() => {
  const user = auth.user
  return Boolean(user && (user.role === 'admin' || user.permissions.includes('*') || user.permissions.some(permission => permission.startsWith('admin.'))))
})

const accountItems = computed(() => [
  { to: '/account', label: t('auth.account.menu.overview'), icon: LayoutDashboardIcon },
  { to: '/account?view=orders', label: t('auth.account.menu.orders'), icon: ShoppingBagIcon },
  { to: '/account?view=payments', label: t('auth.account.menu.payments'), icon: CreditCardIcon },
  { to: '/account?view=comments', label: t('auth.account.menu.comments'), icon: MessageCircleIcon },
  { to: '/account?view=advertising', label: t('auth.account.menu.advertising'), icon: MegaphoneIcon },
  { to: '/account?view=exports', label: t('auth.account.menu.exports'), icon: DownloadIcon }
])

const roleBadge = computed<Record<string, string>>(() => ({
  admin: t('auth.roleAdmin'),
  editor: t('auth.roleEditor'),
  viewer: t('auth.roleViewer')
}))
</script>

<template>
  <NuxtLink
    v-if="!auth.user"
    to="/login"
    class="ml-2 inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors hover:bg-accent"
  >
    <LogInIcon class="h-4 w-4" />
    <span class="hidden sm:inline">{{ t('auth.signIn') }}</span>
  </NuxtLink>
  <DropdownMenuRoot v-else>
    <DropdownMenuTrigger as-child>
      <button
        class="ml-2 inline-flex h-9 items-center gap-1.5 rounded-full border px-1.5 pr-2.5 text-sm transition-colors hover:bg-accent"
        :aria-label="t('auth.account.menu.title')"
      >
        <UiAvatar class="h-7 w-7">
          <UiAvatarFallback class="flex h-7 w-7 items-center justify-center text-[10px] font-semibold">
            {{ auth.user.name.split(' ').map(part => part[0]).slice(0, 2).join('') }}
          </UiAvatarFallback>
        </UiAvatar>
        <span class="hidden max-w-24 truncate sm:inline">{{ auth.user.name }}</span>
        <ChevronDownIcon class="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent align="end" class="z-50 w-60 rounded-xl border bg-popover p-1.5 shadow-lg">
        <DropdownMenuLabel class="px-2.5 py-2">
          <p class="truncate text-sm font-medium">{{ auth.user.name }}</p>
          <p class="truncate text-xs text-muted-foreground">{{ auth.user.email }}</p>
          <p class="mt-1 text-[11px] text-muted-foreground">{{ roleBadge[auth.user.role] ?? auth.user.role }}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator class="my-1 h-px bg-border" />
        <DropdownMenuItem v-for="item in accountItems" :key="item.to" as-child class="rounded-lg outline-none hover:bg-accent">
          <NuxtLink :to="item.to" class="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-sm">
            <component :is="item.icon" class="h-4 w-4 text-muted-foreground" />
            {{ item.label }}
          </NuxtLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator v-if="isAdmin" class="my-1 h-px bg-border" />
        <DropdownMenuItem v-if="isAdmin" as-child class="rounded-lg outline-none hover:bg-accent">
          <NuxtLink to="/admin" class="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-sm">
            <UserCircleIcon class="h-4 w-4 text-muted-foreground" />
            {{ t('public.nav.admin') }}
          </NuxtLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator class="my-1 h-px bg-border" />
        <DropdownMenuItem class="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none hover:bg-accent" @select="auth.logout()">
          <LogOutIcon class="h-4 w-4 text-muted-foreground" />
          {{ t('auth.signOut') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
