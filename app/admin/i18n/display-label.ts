type Translator = (key: string, params?: Record<string, string | number>) => string

const ADMIN_DISPLAY_LABEL_KEYS = {
  campaignStatus: {
    draft: 'res.adcampaigns.status.draft',
    pending_review: 'res.adcampaigns.status.pending_review',
    active: 'res.adcampaigns.status.active',
    paused: 'res.adcampaigns.status.paused',
    rejected: 'res.adcampaigns.status.rejected'
  },
  campaignToggleAction: {
    active: 'res.adcampaigns.pause',
    paused: 'res.adcampaigns.resume'
  },
  campaignToggleNotice: {
    active: 'res.adcampaigns.paused',
    paused: 'res.adcampaigns.resumed'
  },
  postStatus: {
    draft: 'status.draft',
    scheduled: 'status.scheduled',
    published: 'status.published',
    archived: 'status.archived',
    pending: 'status.pending'
  },
  aiScope: {
    site: 'res.aichat.scope_site',
    posts: 'res.aichat.scope_posts',
    pages: 'res.aichat.scope_pages',
    seo: 'res.aichat.scope_seo',
    profile: 'res.aichat.scope_profile',
    store: 'res.aichat.scope_store',
    comments: 'res.aichat.scope_comments',
    media: 'res.aichat.scope_media',
    advertising: 'res.aichat.scope_advertising'
  },
  aiDepth: {
    quick: 'res.aichat.depth_quick',
    balanced: 'res.aichat.depth_balanced',
    deep: 'res.aichat.depth_deep'
  },
  aiSource: {
    post: 'res.aichat.source_post',
    page: 'res.aichat.source_page',
    product: 'res.aichat.source_product'
  },
  aiSuggestion: {
    auditSite: 'res.aichat.suggest_auditSite',
    findSeoProblems: 'res.aichat.suggest_findSeoProblems',
    reviewProfile: 'res.aichat.suggest_reviewProfile',
    findContentGaps: 'res.aichat.suggest_findContentGaps',
    auditContent: 'res.aichat.suggest_auditContent',
    findLongPosts: 'res.aichat.suggest_findLongPosts',
    findInternalLinks: 'res.aichat.suggest_findInternalLinks',
    auditPages: 'res.aichat.suggest_auditPages',
    findPageGaps: 'res.aichat.suggest_findPageGaps',
    findMissingMeta: 'res.aichat.suggest_findMissingMeta',
    prioritizeSeo: 'res.aichat.suggest_prioritizeSeo',
    reviewProjects: 'res.aichat.suggest_reviewProjects',
    reviewFocus: 'res.aichat.suggest_reviewFocus',
    reviewProducts: 'res.aichat.suggest_reviewProducts',
    findProductGaps: 'res.aichat.suggest_findProductGaps',
    compareProducts: 'res.aichat.suggest_compareProducts',
    commentInsights: 'res.aichat.suggest_commentInsights',
    findPendingComments: 'res.aichat.suggest_findPendingComments',
    mediaAudit: 'res.aichat.suggest_mediaAudit',
    findMissingAlt: 'res.aichat.suggest_findMissingAlt',
    adPerformance: 'res.aichat.suggest_adPerformance',
    adBudgetRisk: 'res.aichat.suggest_adBudgetRisk',
    adCampaignSummary: 'res.aichat.suggest_adCampaignSummary'
  },
  aiTool: {
    'site_overview': 'res.aichat.tool_site_overview',
    'content.posts.list': 'res.aichat.tool_content_posts_list',
    'content.posts.get': 'res.aichat.tool_content_posts_get',
    'content.posts.digest': 'res.aichat.tool_content_posts_digest',
    'content.search': 'res.aichat.tool_content_search',
    'pages.list': 'res.aichat.tool_pages_list',
    'seo.summary': 'res.aichat.tool_seo_summary',
    'profile.get': 'res.aichat.tool_profile_get',
    'taxonomy.list': 'res.aichat.tool_taxonomy_list',
    'comments.summary': 'res.aichat.tool_comments_summary',
    'store.summary': 'res.aichat.tool_store_summary',
    'media.summary': 'res.aichat.tool_media_summary'
  },
  profileSectionType: {
    about: 'res.profile.sectionType.about',
    experience: 'res.profile.sectionType.experience',
    projects: 'res.profile.sectionType.projects',
    skills: 'res.profile.sectionType.skills',
    social: 'res.profile.sectionType.social',
    focus: 'res.profile.sectionType.focus',
    education: 'res.profile.sectionType.education',
    certifications: 'res.profile.sectionType.certifications',
    contact: 'res.profile.sectionType.contact'
  },
  exportType: {
    orders: 'res.eximp.type.orders',
    transactions: 'res.eximp.type.transactions',
    inventory: 'res.eximp.type.inventory'
  },
  exportStatus: {
    pending: 'res.eximp.status.pending',
    completed: 'res.eximp.status.completed',
    failed: 'res.eximp.status.failed'
  },
  friendBacklinkStatus: {
    found: 'res.friendlinks.backlink_found',
    not_found: 'res.friendlinks.backlink_not_found',
    unknown: 'res.friendlinks.backlink_unknown',
    unreachable: 'res.friendlinks.backlink_unreachable',
    error: 'res.friendlinks.backlink_error'
  },
  friendSiteStatus: {
    online: 'res.friendlinks.site_online',
    unreachable: 'res.friendlinks.site_unreachable',
    timeout: 'res.friendlinks.site_timeout',
    error: 'res.friendlinks.site_error',
    unknown: 'res.friendlinks.site_unknown'
  },
  mediaUsage: {
    general: 'res.media.usage.general',
    post_content: 'res.media.usage.post_content',
    post_featured: 'res.media.usage.post_featured',
    page_content: 'res.media.usage.page_content',
    slider: 'res.media.usage.slider',
    advertising: 'res.media.usage.advertising',
    avatar: 'res.media.usage.avatar',
    site_logo: 'res.media.usage.site_logo',
    og_image: 'res.media.usage.og_image'
  },
  mediaUsageShort: {
    general: 'media.usage.general',
    post_content: 'media.usage.post_content',
    post_featured: 'media.usage.post_featured',
    page_content: 'media.usage.page_content',
    slider: 'media.usage.slider',
    advertising: 'media.usage.advertising',
    avatar: 'media.usage.avatar',
    site_logo: 'media.usage.site_logo',
    og_image: 'media.usage.og_image'
  },
  navigationType: {
    custom: 'res.navigation.type.custom',
    page: 'res.navigation.type.page',
    post: 'res.navigation.type.post',
    category: 'res.navigation.type.category',
    tag: 'res.navigation.type.tag'
  },
  navigationStatus: {
    clean: 'res.navigation.status.clean',
    dirty: 'res.navigation.status.dirty',
    saving: 'res.navigation.status.saving',
    saved: 'res.navigation.status.saved',
    error: 'res.navigation.status.error'
  },
  notificationTab: {
    channels: 'res.notifications.tab_channels',
    subscriptions: 'res.notifications.tab_subscriptions',
    logs: 'res.notifications.tab_logs'
  },
  notificationDeliveryStatus: {
    success: 'res.notifications.dl_success',
    failed: 'res.notifications.dl_failed',
    dead: 'res.notifications.dl_dead',
    pending: 'res.notifications.dl_pending',
    sending: 'res.notifications.dl_sending'
  },
  sliderStatus: {
    active: 'res.slider.status.active',
    scheduled: 'res.slider.status.scheduled',
    expired: 'res.slider.status.expired',
    disabled: 'res.slider.status.disabled'
  },
  localizedStatus: {
    missing: 'ext.localized.missing',
    incomplete: 'ext.localized.incomplete',
    complete: 'ext.localized.complete',
    defaultTag: 'ext.localized.defaultTag'
  },
  editorMode: {
    rich: 'editor.mode.rich',
    markdown: 'editor.mode.markdown',
    preview: 'editor.mode.preview'
  }
} as const

export type AdminDisplayLabelDomain = keyof typeof ADMIN_DISPLAY_LABEL_KEYS

const dynamicKeys = Object.values(ADMIN_DISPLAY_LABEL_KEYS).flatMap(labels => Object.values(labels))

export type AdminI18nDynamicKeyAllowlist = Readonly<Record<string, readonly string[]>>

/**
 * The audit indexes this map by the exact first argument expression, not by a
 * variable name.  Keeping the expression and its finite output set together
 * prevents a broad `key`/`string` exemption from hiding an unsafe translation.
 */
export const ADMIN_I18N_DYNAMIC_KEY_ALLOWLIST: AdminI18nDynamicKeyAllowlist = {
  '`ext.localized.${props.status}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.localizedStatus),
  '`editor.mode.${m}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.editorMode),
  '`res.aichat.suggest_${key}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.aiSuggestion),
  '`res.aichat.scope_${s}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.aiScope),
  '`res.aichat.scope_${scope}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.aiScope),
  '`res.aichat.scope_${preset.defaultScope}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.aiScope),
  '`res.aichat.depth_${d}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.aiDepth),
  '`res.aichat.depth_${depth}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.aiDepth),
  '`res.aichat.depth_${preset.defaultDepth}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.aiDepth),
  '`res.aichat.source_${type}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.aiSource),
  '`res.aichat.tool_${name.replace(/\\./g, \'_\')}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.aiTool),
  '`res.profile.sectionType.${section.type}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.profileSectionType),
  '`res.eximp.type.${job.type}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.exportType),
  '`res.eximp.status.${job.status}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.exportStatus),
  '`res.friendlinks.backlink_${link.backlinkStatus}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.friendBacklinkStatus),
  '`res.friendlinks.site_${submission.siteStatus}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.friendSiteStatus),
  '`res.friendlinks.backlink_${submission.backlinkStatus}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.friendBacklinkStatus),
  '`res.media.usage.${usage}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.mediaUsage),
  '`res.navigation.status.${status}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.navigationStatus),
  '`res.navigation.type.${item.type}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.navigationType),
  '`res.notifications.tab_${name}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.notificationTab),
  '`res.notifications.dl_${delivery.status}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.notificationDeliveryStatus),
  '`res.slider.status.${statusOf(item)}`': Object.values(ADMIN_DISPLAY_LABEL_KEYS.sliderStatus),
  'key': dynamicKeys
}

/** Technical identifiers intentionally remain unchanged in admin templates. */
export const ADMIN_I18N_HARDCODED_COPY_ALLOWLIST = [
  'USD',
  'CNY',
  'EUR',
  'OpenAI',
  'Anthropic',
  'ms',
  '· tok ·',
  '· · / tok · ms',
  'nofollow',
  '(webp)',
  'SSL',
  'Redis ·',
  'REDIS_URL',
  'Nuxt Admin',
  '[paid]'
] as const

export function resolveAdminDisplayLabel(
  t: Translator,
  domain: AdminDisplayLabelDomain,
  value: unknown
): string {
  if (value === null || value === undefined || value === '') return '—'
  const key = (ADMIN_DISPLAY_LABEL_KEYS[domain] as Record<string, string>)[String(value)]
  return key ? t(key) : String(value)
}
