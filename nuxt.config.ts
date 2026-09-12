import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@pinia/nuxt',
    '@nuxt/eslint'
  ],

  components: [
    { path: '~/admin/ui', pathPrefix: false },
    { path: '~/admin/framework', pathPrefix: false },
    { path: '~/components/public', pathPrefix: false },
    { path: '~/modules/advertising/components', pathPrefix: false }
  ],

  // Framework DSL auto-imports (builders available everywhere)
  imports: {
    dirs: [
      '~/stores',
      '~/admin/core',
      '~/admin/panel',
      '~/admin/navigation',
      '~/admin/permissions',
      '~/admin/schemas/builders',
      '~/admin/infolists',
      '~/admin/actions',
      '~/admin/widgets',
      '~/admin/modules',
      '~/admin/forms',
      '~/admin/tables',
      '~/admin/framework',
      '~/admin/notifications',
      '~/admin/i18n'
    ]
  },

  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/api/**': { cors: true }
  },

  compatibilityDate: '2026-06-30',

  nitro: {
    storage: {
      media: { driver: 'fs', base: './.data/media' },
      exports: { driver: 'fs', base: './.data/exports' }
    }
  },

  vite: {
    plugins: [tailwindcss()]
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
