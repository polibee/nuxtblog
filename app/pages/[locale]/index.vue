<script setup lang="ts">
/* Explicit localized home route. The root [slug] compatibility route also
   matches one segment, so this file gives configured locale prefixes a
   concrete route with the same home component. */
import HomePage from '../index.vue'

definePageMeta({ layout: 'public' })
</script>

<template>
  <HomePage />
</template>
