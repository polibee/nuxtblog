import type { AdminRole } from '#shared/types/api'

/* Role -> permission mapping. Mirrors the demo roles seed; replace
   with a DB-backed RBAC registry in a later phase if needed. */

const EDITOR_PERMISSIONS = [
  'posts.view', 'posts.create', 'posts.edit', 'posts.delete',
  'categories.view', 'categories.create', 'categories.edit', 'categories.delete',
  'tags.view', 'tags.create', 'tags.edit', 'tags.delete',
  'pages.view', 'pages.create', 'pages.edit', 'pages.delete',
  'media.view', 'media.create', 'media.edit', 'media.delete',
  'content.view', 'content.create', 'content.edit', 'content.delete',
  'sidebar-cards.view', 'sidebar-cards.create', 'sidebar-cards.edit', 'sidebar-cards.delete',
  'users.view', 'orders.view',
  'analytics.view',
  'profile.view', 'profile.edit',
  'friend-links.view', 'friend-links.edit',
  'notifications.view', 'notifications.edit',
  'ai.use'
]

const VIEWER_PERMISSIONS = [
  'posts.view', 'categories.view', 'tags.view', 'pages.view', 'media.view', 'content.view',
  'sidebar-cards.view', 'users.view', 'orders.view',
  'analytics.view',
  'profile.view',
  'friend-links.view'
]

export function permissionsForRole(role: AdminRole): string[] {
  switch (role) {
    case 'admin':
      return ['*']
    case 'editor':
      return EDITOR_PERMISSIONS
    default:
      return VIEWER_PERMISSIONS
  }
}
