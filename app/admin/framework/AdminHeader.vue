<script setup lang="ts">
import { ExternalLinkIcon, GlobeIcon, LogOutIcon, MenuIcon, MoonIcon, SunIcon } from 'lucide-vue-next'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'

defineEmits<{ 'toggle-sidebar': [] }>()

const ui = useUiStore()
const auth = useAuthStore()
const { t, locale } = useI18n()

const roleBadge = computed<Record<string, string>>(() => ({
  admin: t('auth.roleAdmin'),
  editor: t('auth.roleEditor'),
  viewer: t('auth.roleViewer')
}))
</script>

<template>
  <header class="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-6">
    <UiButton
      variant="ghost"
      size="icon"
      class="lg:hidden"
      @click="$emit('toggle-sidebar')"
    >
      <MenuIcon class="h-5 w-5" />
    </UiButton>

    <div class="min-w-0 flex-1" />

    <NuxtLink
      to="/"
      class="hidden h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-accent sm:inline-flex"
    >
      <ExternalLinkIcon class="h-4 w-4" />
      {{ t('admin.visitSite') }}
    </NuxtLink>

    <!-- locale switcher -->
    <DropdownMenuRoot>
      <DropdownMenuTrigger as-child>
        <UiButton
          variant="ghost"
          size="icon"
          aria-label="Language"
        >
          <GlobeIcon class="h-4 w-4" />
        </UiButton>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          align="end"
          class="z-50 w-36 rounded-md border bg-popover p-1 shadow-md"
        >
          <DropdownMenuRadioGroup
            :model-value="locale"
            @update:model-value="(v) => { locale = v as 'zh-CN' | 'en'; reloadNuxtApp() }"
          >
            <DropdownMenuRadioItem
              v-for="item in LOCALES"
              :key="item.value"
              :value="item.value"
              class="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
            >
              {{ item.label }}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>

    <!-- theme toggle -->
    <UiButton
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      @click="ui.toggleTheme()"
    >
      <SunIcon
        v-if="ui.theme === 'dark'"
        class="h-4 w-4"
      />
      <MoonIcon
        v-else
        class="h-4 w-4"
      />
    </UiButton>

    <!-- user menu -->
    <DropdownMenuRoot v-if="auth.user">
      <DropdownMenuTrigger as-child>
        <button
          class="flex h-9 items-center gap-2 rounded-full border pl-1 pr-3 text-sm transition-colors hover:bg-accent"
        >
          <UiAvatar class="h-7 w-7">
            <UiAvatarFallback class="flex h-7 w-7 items-center justify-center text-[10px] font-semibold">
              {{ auth.user.name.split(' ').map(p => p[0]).slice(0, 2).join('') }}
            </UiAvatarFallback>
          </UiAvatar>
          <span class="hidden sm:inline">{{ auth.user.name }}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          align="end"
          class="z-50 w-56 rounded-md border bg-popover p-1 shadow-md"
        >
          <DropdownMenuLabel class="px-2 py-1.5">
            <p class="text-sm font-medium">
              {{ auth.user.name }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ auth.user.email }}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator class="my-1 h-px bg-border" />
          <div class="px-2 py-1 text-xs text-muted-foreground">
            {{ roleBadge[auth.user.role] ?? auth.user.role }}
          </div>
          <DropdownMenuSeparator class="my-1 h-px bg-border" />
          <DropdownMenuItem
            class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
            @select="auth.logout()"
          >
            <LogOutIcon class="h-4 w-4" /> {{ t('auth.signOut') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </header>
</template>
