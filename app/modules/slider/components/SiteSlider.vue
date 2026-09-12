<script setup lang="ts">
import type { PublicSlider, PublicSliderItem } from '#shared/schemas/slider'

/* SiteSlider (P19): consumes the resolved public payload only —
   filtering/scheduling/locale fallback already happened server-side.
   Desktop 16:7, mobile 4:3 (mobile image), object-cover, no CLS:
   the container owns the aspect ratio before images load. */

const props = defineProps<{ sliderKey: string }>()

const { localeCode } = useLocale()

const { data } = useFetch<PublicSlider>(`/api/public/sliders/${props.sliderKey}`, {
  key: `slider-${props.sliderKey}-${localeCode.value}`,
  query: { locale: localeCode.value }
})

const config = computed(() => data.value?.config ?? null)
const items = computed(() => data.value?.items ?? [])
const count = computed(() => items.value.length)

const current = ref(0)
const paused = ref(false)
const reducedMotion = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const autoplayOn = computed(() =>
  config.value?.autoplay === true
  && count.value > 1
  && !reducedMotion.value
)

function go(index: number): void {
  if (count.value === 0) return
  current.value = ((index % count.value) + count.value) % count.value
}
function next(): void {
  go(current.value + 1)
}
function prev(): void {
  go(current.value - 1)
}

watchEffect(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (autoplayOn.value && config.value && !paused.value) {
    timer = setInterval(next, Math.max(config.value.interval, 1000))
  }
})

onMounted(() => {
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisibility)
})
function onVisibility(): void {
  paused.value = document.hidden
}

/* touch swipe */
let touchX = 0
let touchY = 0
function onTouchStart(e: TouchEvent): void {
  touchX = e.touches[0]?.clientX ?? 0
  touchY = e.touches[0]?.clientY ?? 0
}
function onTouchEnd(e: TouchEvent): void {
  const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX
  const dy = (e.changedTouches[0]?.clientY ?? 0) - touchY
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) next()
    else prev()
  }
}

/* whole slide is the link; no url → plain image (never href="#") */
const external = (url: string) => /^https?:\/\//i.test(url)

const trackStyle = computed(() => ({
  transform: `translateX(-${current.value * 100}%)`
}))

function slideRel(item: PublicSliderItem): string | undefined {
  return item.target === 'blank' ? 'noopener noreferrer' : undefined
}
</script>

<template>
  <section
    v-if="config && count > 0"
    class="relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted md:aspect-[3/1]"
    style="max-height: 320px"
    tabindex="0"
    :aria-roledescription="'carousel'"
    :aria-label="sliderKey"
    @mouseenter="config.pauseOnHover && (paused = true)"
    @mouseleave="config.pauseOnHover && (paused = false)"
    @keydown.left.prevent="prev"
    @keydown.right.prevent="next"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <!-- slide transition -->
    <div
      v-if="config.transition === 'slide'"
      class="flex h-full transition-transform"
      :class="reducedMotion ? 'duration-0' : 'duration-500'"
      :style="trackStyle"
    >
      <div
        v-for="item in items"
        :key="item.id"
        class="relative h-full w-full shrink-0"
      >
        <picture>
          <source
            v-if="item.mobileImage"
            media="(max-width: 767px)"
            :srcset="item.mobileImage"
          >
          <img
            :src="item.image"
            :alt="item.alt"
            :loading="item.id === items[0]?.id ? 'eager' : 'lazy'"
            :fetchpriority="item.id === items[0]?.id ? 'high' : undefined"
            class="h-full w-full object-cover"
          >
        </picture>
        <div
          v-if="item.title || item.description || item.buttonText"
          class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-5 pb-6 text-left sm:p-8"
        >
          <p
            v-if="item.title"
            class="text-lg font-semibold text-white sm:text-2xl"
          >
            {{ item.title }}
          </p>
          <p
            v-if="item.description"
            class="mt-1 max-w-2xl text-sm text-white/85 sm:text-base"
          >
            {{ item.description }}
          </p>
          <span
            v-if="item.buttonText"
            class="mt-3 inline-flex h-9 items-center rounded-md bg-white px-4 text-sm font-medium text-neutral-900"
          >
            {{ item.buttonText }} →
          </span>
        </div>
      </div>
    </div>

    <!-- fade transition -->
    <div
      v-else
      class="h-full"
    >
      <div
        v-for="(item, i) in items"
        :key="item.id"
        class="absolute inset-0 transition-opacity"
        :class="i === current ? (reducedMotion ? 'duration-0 opacity-100' : 'duration-700 opacity-100') : 'pointer-events-none opacity-0'"
      >
        <picture>
          <source
            v-if="item.mobileImage"
            media="(max-width: 767px)"
            :srcset="item.mobileImage"
          >
          <img
            :src="item.image"
            :alt="item.alt"
            :loading="i === 0 ? 'eager' : 'lazy'"
            :fetchpriority="i === 0 ? 'high' : undefined"
            class="h-full w-full object-cover"
          >
        </picture>
        <div
          v-if="item.title || item.description || item.buttonText"
          class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-5 pb-6 text-left sm:p-8"
        >
          <p
            v-if="item.title"
            class="text-lg font-semibold text-white sm:text-2xl"
          >
            {{ item.title }}
          </p>
          <p
            v-if="item.description"
            class="mt-1 max-w-2xl text-sm text-white/85 sm:text-base"
          >
            {{ item.description }}
          </p>
          <span
            v-if="item.buttonText"
            class="mt-3 inline-flex h-9 items-center rounded-md bg-white px-4 text-sm font-medium text-neutral-900"
          >
            {{ item.buttonText }} →
          </span>
        </div>
      </div>
    </div>

    <!-- whole-slide link overlay (visual CTA lives in the caption) -->
    <template
      v-for="(item, i) in items"
      :key="`link-${item.id}`"
    >
      <a
        v-if="item.url && external(item.url)"
        :href="item.url"
        :target="item.target === 'blank' ? '_blank' : undefined"
        :rel="slideRel(item)"
        class="absolute inset-0"
        :class="i === current ? '' : 'sr-only'"
        :aria-label="item.title || item.alt || 'slide'"
        :tabindex="i === current ? 0 : -1"
      />
      <NuxtLink
        v-else-if="item.url"
        :to="item.url"
        class="absolute inset-0"
        :class="i === current ? '' : 'sr-only'"
        :aria-label="item.title || item.alt || 'slide'"
        :tabindex="i === current ? 0 : -1"
      />
    </template>

    <!-- arrows -->
    <template v-if="config.showArrows && count > 1">
      <button
        type="button"
        class="absolute left-2 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white transition-colors hover:bg-black/55"
        aria-label="Previous slide"
        @click.stop.prevent="prev"
      >
        ←
      </button>
      <button
        type="button"
        class="absolute right-2 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white transition-colors hover:bg-black/55"
        aria-label="Next slide"
        @click.stop.prevent="next"
      >
        →
      </button>
    </template>

    <!-- indicators -->
    <div
      v-if="config.showIndicators && count > 1"
      class="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5"
    >
      <button
        v-for="(item, i) in items"
        :key="`dot-${item.id}`"
        type="button"
        class="h-1.5 rounded-full transition-all"
        :class="i === current ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'"
        :aria-label="`Go to slide ${i + 1}`"
        @click.stop.prevent="go(i)"
      />
    </div>
  </section>
</template>
