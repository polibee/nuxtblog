<script setup lang="ts">
import type { Component } from 'vue'
import ResourceListPage from '~/admin/framework/ResourceListPage.vue'
import ResourceFormPage from '~/admin/framework/ResourceFormPage.vue'
import ResourceViewPage from '~/admin/framework/ResourceViewPage.vue'

/* =============================================================
 * Resource router:
 *   /admin/{resource}              -> List
 *   /admin/{resource}/create       -> Create
 *   /admin/{resource}/{id}         -> View
 *   /admin/{resource}/{id}/edit    -> Edit
 * ============================================================= */

const route = useRoute()
const allow = useCan()

const raw = route.params.path
const segments = (Array.isArray(raw) ? raw : [raw]).map(String)

/* resource names may contain slashes (e.g. "store/products" serving
   /api/admin/store/products): match the longest registered prefix */
let resource = null
let nameSegments = 0
for (let i = Math.min(segments.length, 4); i >= 1; i--) {
  const candidate = getResource(segments.slice(0, i).join('/'))
  if (candidate) {
    resource = candidate
    nameSegments = i
    break
  }
}
if (!resource) {
  throw createError({ statusCode: 404, statusMessage: `Unknown resource "${segments[0]}"`, fatal: true })
}

if (!allow(`${resource.permissionPrefix}.view`)) {
  throw createError({ statusCode: 403, statusMessage: 'You do not have permission to view this resource.', fatal: true })
}

const rest = segments.slice(nameSegments)
const id = rest[0]
const action = rest[1]

/* schema presence checks: pages cannot render without their schemas */
if ((id === 'create' || action === 'edit') && !resource.form) {
  throw createError({ statusCode: 400, statusMessage: `Resource "${resource.name}" does not define a form schema.`, fatal: true })
}
if (!id && !resource.table) {
  throw createError({ statusCode: 400, statusMessage: `Resource "${resource.name}" does not define a table schema.`, fatal: true })
}

/* resource page overrides (admin extension point): list + detail view
   (e.g. the schema-driven settings workspace at /admin/settings/{page},
   ADR 0006) */
const listOverride = resource.pages?.list
const viewOverride = resource.pages?.view

let component: Component | null = null
const bind = reactive<Record<string, unknown>>({ resource })

if (!id) {
  component = listOverride ?? ResourceListPage
} else if (id === 'create') {
  if (!allow(`${resource.permissionPrefix}.create`)) {
    throw createError({ statusCode: 403, statusMessage: 'Create permission required.', fatal: true })
  }
  component = ResourceFormPage
  bind.mode = 'create'
} else if (action === 'edit') {
  if (!allow(`${resource.permissionPrefix}.edit`)) {
    throw createError({ statusCode: 403, statusMessage: 'Edit permission required.', fatal: true })
  }
  component = ResourceFormPage
  bind.mode = 'edit'
  bind.id = id
} else {
  if (!allow(`${resource.permissionPrefix}.view`)) {
    throw createError({ statusCode: 403, statusMessage: 'View permission required.', fatal: true })
  }
  component = viewOverride ?? ResourceViewPage
  bind.id = id
}

useHead({ title: resource.labelPlural })
</script>

<template>
  <component
    :is="component"
    v-bind="bind"
    :key="route.fullPath"
  />
</template>
