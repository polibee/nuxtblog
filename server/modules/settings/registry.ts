/* P34 Settings Registry (docs/设置.txt §11/52/69/81): single source of
   truth for what settings exist, their types, defaults, validation and
   presentation. The database stores overrides only (§67) — a setting
   not in the DB resolves to Environment > Database > Default (§42).
   Labels are inline bilingual (admin i18n is zh-CN/en). */

export type SettingsFieldType = 'text' | 'textarea' | 'number' | 'switch' | 'select' | 'media' | 'secret'

export interface Bilingual {
  zh: string
  en: string
}

export interface SettingOption {
  value: string
  label: Bilingual
}

export interface SettingCondition {
  key: string
  equals: string | number | boolean
}

export interface SettingDefinition {
  /* dotted namespace (§52) */
  key: string
  /* pre-registry storage key — written alongside for legacy consumers,
     removed from resolution once dotted value exists (§42 adapter) */
  legacyKey?: string
  /* environment variable that overrides the database (§42) */
  envKey?: string
  type: SettingsFieldType
  label: Bilingual
  description?: Bilingual
  defaultValue?: string | number | boolean
  options?: SettingOption[]
  optionsLoader?: 'locales'
  required?: boolean
  min?: number
  max?: number
  /* placeholder (text/textarea) */
  placeholder?: Bilingual
  visibleWhen?: SettingCondition
  /* secrets never return their value — only configured/last4 (§44) */
  sensitive?: boolean
}

export interface SettingsSectionDef {
  id: string
  title: Bilingual
  description?: Bilingual
  fields: SettingDefinition[]
}

export type SettingsGroupId = 'general' | 'publishing' | 'commerce' | 'growth' | 'ai' | 'localization' | 'system'

export interface SettingsPageDef {
  id: string
  group: SettingsGroupId
  title: Bilingual
  description: Bilingual
  icon: string
  order: number
  /* hide the page when this module is disabled (§53/76) */
  module?: string
  sections: SettingsSectionDef[]
}

export const SETTINGS_GROUP_LABELS: Record<SettingsGroupId, Bilingual> = {
  general: { zh: '通用', en: 'General' },
  publishing: { zh: '发布', en: 'Publishing' },
  commerce: { zh: '商务', en: 'Commerce' },
  growth: { zh: '增长', en: 'Growth' },
  ai: { zh: 'AI', en: 'AI' },
  localization: { zh: '本地化', en: 'Localization' },
  system: { zh: '系统', en: 'System' }
}

const pages = new Map<string, SettingsPageDef>()

export function registerSettingsPage(def: SettingsPageDef): void {
  pages.set(def.id, def)
}

export function getSettingsPageDef(id: string): SettingsPageDef | undefined {
  return pages.get(id)
}

export function listSettingsPageDefs(): SettingsPageDef[] {
  return [...pages.values()].sort((a, b) => a.order - b.order)
}

/* ---------------- core page definitions (S3 §17-24) ---------------- */

registerSettingsPage({
  id: 'general',
  group: 'general',
  order: 10,
  icon: 'settings',
  title: { zh: '常规', en: 'General' },
  description: { zh: '站点基本信息与首页行为。', en: 'Site identity and homepage behaviour.' },
  sections: [
    {
      id: 'identity',
      title: { zh: '站点身份', en: 'Site Identity' },
      fields: [
        {
          key: 'site.title', legacyKey: 'SITE_NAME', type: 'text', required: true,
          label: { zh: '站点标题', en: 'Site title' },
          description: { zh: '显示在站点头部与浏览器标签页。', en: 'Shown in the site header and browser tab.' },
          defaultValue: 'Blog Framework'
        },
        {
          key: 'site.description', legacyKey: 'SITE_DESCRIPTION', type: 'textarea',
          label: { zh: '站点描述', en: 'Site description' },
          description: { zh: '默认 meta 描述（支持本地化）。', en: 'Default meta description (localizable).' },
          defaultValue: 'A blog framework built on Nuxt + NuxtAdmin.'
        },
        {
          key: 'site.url', legacyKey: 'SITE_URL', type: 'text',
          label: { zh: '站点 URL', en: 'Site URL' },
          description: { zh: '用于 sitemap/RSS/OG 的规范地址，如 https://example.com', en: 'Canonical origin used by sitemap/RSS/OG, e.g. https://example.com' },
          placeholder: { zh: 'https://example.com', en: 'https://example.com' }
        },
        {
          key: 'site.logo', type: 'media',
          label: { zh: '站点 Logo', en: 'Logo' }
        }
      ]
    },
    {
      id: 'administration',
      title: { zh: '管理', en: 'Administration' },
      fields: [
        {
          key: 'site.admin_email', type: 'text',
          label: { zh: '管理员邮箱', en: 'Admin email' },
          description: { zh: '接收系统通知（订单、注册、审核）。', en: 'Receives system notifications (orders, signups, reviews).' }
        },
        {
          key: 'site.timezone', type: 'select',
          label: { zh: '时区', en: 'Timezone' },
          defaultValue: 'UTC',
          options: [
            { value: 'UTC', label: { zh: 'UTC', en: 'UTC' } },
            { value: 'Asia/Shanghai', label: { zh: '中国标准时间', en: 'Asia/Shanghai' } },
            { value: 'Asia/Tokyo', label: { zh: '日本标准时间', en: 'Asia/Tokyo' } },
            { value: 'America/New_York', label: { zh: '美东时间', en: 'America/New_York' } },
            { value: 'Europe/London', label: { zh: '伦敦', en: 'Europe/London' } }
          ]
        },
        {
          key: 'site.maintenance_mode', legacyKey: 'MAINTENANCE_MODE', type: 'switch',
          label: { zh: '维护模式', en: 'Maintenance mode' },
          description: { zh: '公开页面显示维护提示。', en: 'Show a maintenance notice on public pages.' },
          defaultValue: false
        }
      ]
    },
    {
      id: 'homepage',
      title: { zh: '首页', en: 'Homepage' },
      fields: [
        {
          key: 'content.posts_per_page', legacyKey: 'POSTS_PER_PAGE', type: 'number',
          label: { zh: '文章列表每页数量', en: 'Posts per page' },
          defaultValue: 12, min: 1, max: 100
        }
      ]
    }
  ]
})

registerSettingsPage({
  id: 'media',
  group: 'publishing',
  order: 20,
  icon: 'image',
  title: { zh: '媒体', en: 'Media' },
  description: { zh: '上传与图片处理默认值（尺寸预设属于系统 preset）。', en: 'Upload and image processing defaults (size presets are system presets).' },
  sections: [
    {
      id: 'uploads',
      title: { zh: '上传', en: 'Uploads' },
      fields: [
        { key: 'media.max_upload_size', type: 'number', label: { zh: '最大上传体积（MB）', en: 'Max upload size (MB)' }, defaultValue: 20, min: 1, max: 512 },
        { key: 'media.preserve_original', type: 'switch', label: { zh: '保留原图', en: 'Preserve original' }, description: { zh: '生成变体的同时保留未压缩原图。', en: 'Keep the unprocessed original alongside generated variants.' }, defaultValue: true }
      ]
    },
    {
      id: 'processing',
      title: { zh: '图片处理', en: 'Image processing' },
      fields: [
        { key: 'media.generate_variants', type: 'switch', label: { zh: '生成尺寸变体', en: 'Generate size variants' }, defaultValue: true },
        { key: 'media.strip_exif', type: 'switch', label: { zh: '移除 EXIF 信息', en: 'Strip EXIF' }, defaultValue: true },
        { key: 'media.default_quality', type: 'number', label: { zh: '默认压缩质量', en: 'Default quality' }, defaultValue: 82, min: 40, max: 100 }
      ]
    }
  ]
})

registerSettingsPage({
  id: 'comments',
  group: 'publishing',
  order: 21,
  icon: 'clipboard',
  title: { zh: '评论', en: 'Comments' },
  description: { zh: '评论功能开关与默认行为（评论内容在评论管理页）。', en: 'Comment feature switches and defaults (content lives in comment moderation).' },
  module: 'comments',
  sections: [
    {
      id: 'general',
      title: { zh: '常规', en: 'General' },
      fields: [
        { key: 'comments.enabled', type: 'switch', label: { zh: '启用评论', en: 'Enable comments' }, defaultValue: true },
        { key: 'comments.guest_enabled', type: 'switch', label: { zh: '允许游客评论', en: 'Guest comments' }, defaultValue: true },
        { key: 'comments.require_guest_email', type: 'switch', label: { zh: '游客必须留邮箱', en: 'Require guest email' }, defaultValue: false, visibleWhen: { key: 'comments.guest_enabled', equals: true } },
        { key: 'comments.max_length', type: 'number', label: { zh: '评论最大长度', en: 'Max length' }, defaultValue: 3000, min: 100, max: 10000 },
        { key: 'comments.max_reply_depth', type: 'number', label: { zh: '最大回复层级', en: 'Maximum reply depth' }, defaultValue: 3, min: 1, max: 10 }
      ]
    },
    {
      id: 'identity',
      title: { zh: '身份与展示', en: 'Identity and display' },
      fields: [
        { key: 'comments.show_browser', type: 'switch', label: { zh: '显示浏览器', en: 'Show browser' }, defaultValue: true },
        { key: 'comments.show_os', type: 'switch', label: { zh: '显示操作系统', en: 'Show operating system' }, defaultValue: true },
        { key: 'comments.show_gravatar', type: 'switch', label: { zh: '显示 Gravatar', en: 'Show Gravatar' }, defaultValue: true },
        { key: 'comments.show_guest_website', type: 'switch', label: { zh: '显示游客网址', en: 'Show guest websites' }, defaultValue: true }
      ]
    },
    {
      id: 'turnstile',
      title: { zh: 'Turnstile 验证', en: 'Turnstile verification' },
      fields: [
        { key: 'comments.turnstile_enabled', type: 'switch', label: { zh: '启用 Turnstile', en: 'Enable Turnstile' }, defaultValue: false },
        { key: 'comments.turnstile_site_key', type: 'text', envKey: 'TURNSTILE_SITE_KEY', label: { zh: '站点密钥', en: 'Site key' }, defaultValue: '' },
        { key: 'comments.turnstile_secret_key', type: 'secret', envKey: 'TURNSTILE_SECRET_KEY', sensitive: true, label: { zh: '服务端密钥', en: 'Server secret key' }, description: { zh: '仅服务端使用，后台只显示配置状态和末四位。', en: 'Server-only; the admin shows configuration status and the last four characters.' }, defaultValue: '' }
      ]
    },
    {
      id: 'moderation',
      title: { zh: '审核', en: 'Moderation' },
      fields: [
        { key: 'comments.require_approval', type: 'switch', label: { zh: '先审后显', en: 'Require approval' }, description: { zh: '新评论进入待审队列，通过后才公开。', en: 'New comments wait in the moderation queue before going public.' }, defaultValue: true }
      ]
    }
  ]
})

registerSettingsPage({
  id: 'seo',
  group: 'publishing',
  order: 22,
  icon: 'globe',
  title: { zh: 'SEO', en: 'SEO' },
  description: { zh: '全站 SEO 默认值（单页 SEO 在对应内容实体上配置）。', en: 'Site-wide SEO defaults (per-page SEO lives on each entity).' },
  sections: [
    {
      id: 'defaults',
      title: { zh: '站点默认', en: 'Site defaults' },
      fields: [
        { key: 'seo.default_title_pattern', type: 'text', label: { zh: '标题模板', en: 'Title pattern' }, description: { zh: '可用变量 {site} {page}。', en: 'Variables: {site} {page}.' }, placeholder: { zh: '{page} - {site}', en: '{page} - {site}' } },
        { key: 'seo.default_og_image', type: 'media', label: { zh: '默认 OG 图片', en: 'Default OG image' } }
      ]
    },
    {
      id: 'indexing',
      title: { zh: '收录', en: 'Indexing' },
      fields: [
        { key: 'seo.index_posts', type: 'switch', label: { zh: '文章允许收录', en: 'Index posts' }, defaultValue: true },
        { key: 'seo.index_pages', type: 'switch', label: { zh: '页面允许收录', en: 'Index pages' }, defaultValue: true },
        { key: 'seo.noindex_search', type: 'switch', label: { zh: '搜索页 noindex', en: 'Noindex search pages' }, defaultValue: true }
      ]
    },
    {
      id: 'integrations',
      title: { zh: '站点验证与统计', en: 'Verification and analytics' },
      description: { zh: '配置统计平台、站长验证和广告平台验证代码。', en: 'Configure analytics, webmaster verification, and advertising verification.' },
      fields: [
        { key: 'seo.analytics_enabled', type: 'switch', label: { zh: '启用统计代码', en: 'Enable analytics code' }, defaultValue: false },
        { key: 'seo.analytics_head_code', type: 'textarea', label: { zh: '统计代码', en: 'Analytics code' }, description: { zh: '粘贴平台提供的页头代码，仅管理员可编辑。', en: 'Paste the provider snippet for the document head. Admin-only.' }, placeholder: { zh: '<script>…</script>', en: '<script>…</script>' } },
        { key: 'seo.webmaster_google', type: 'text', label: { zh: 'Google Webmaster 验证', en: 'Google Webmaster verification' }, placeholder: { zh: '验证 token', en: 'Verification token' } },
        { key: 'seo.webmaster_bing', type: 'text', label: { zh: 'Bing Webmaster 验证', en: 'Bing Webmaster verification' }, placeholder: { zh: '验证 token', en: 'Verification token' } },
        { key: 'seo.webmaster_baidu', type: 'text', label: { zh: '百度站长验证', en: 'Baidu Webmaster verification' }, placeholder: { zh: '验证 token', en: 'Verification token' } },
        { key: 'seo.ad_verification_code', type: 'textarea', label: { zh: '广告平台验证代码', en: 'Advertising verification code' }, description: { zh: '仅用于广告平台站点验证，不等同于广告创意代码。', en: 'For advertising platform site verification only; not an ad creative.' }, placeholder: { zh: '<meta …> 或验证代码', en: '<meta …> or verification code' } }
      ]
    },
    {
      id: 'sitemap',
      title: { zh: 'Sitemap', en: 'Sitemap' },
      fields: [
        { key: 'seo.sitemap_enabled', type: 'switch', label: { zh: '启用 sitemap', en: 'Enable sitemap' }, defaultValue: true },
        { key: 'seo.sitemap_include_images', type: 'switch', label: { zh: '包含图片', en: 'Include images' }, defaultValue: false },
        {
          key: 'seo.robots_txt', type: 'textarea',
          label: { zh: 'robots.txt 内容', en: 'robots.txt content' },
          description: { zh: '留空使用安全默认规则；Sitemap 行会自动指向本站 sitemap.xml。', en: 'Leave empty to use safe defaults; the Sitemap line always points to this site.' },
          placeholder: { zh: 'User-agent: *\nAllow: /', en: 'User-agent: *\nAllow: /' }
        }
      ]
    }
  ]
})

registerSettingsPage({
  id: 'search',
  group: 'publishing',
  order: 23,
  icon: 'eye',
  title: { zh: '搜索', en: 'Search' },
  description: { zh: '站内搜索行为（第一版为 SQL LIKE，外部引擎后置）。', en: 'On-site search behaviour (SQL LIKE first; external engines later).' },
  sections: [
    {
      id: 'general',
      title: { zh: '常规', en: 'General' },
      fields: [
        { key: 'search.enabled', type: 'switch', label: { zh: '启用搜索', en: 'Enable search' }, defaultValue: true },
        { key: 'search.results_per_page', type: 'number', label: { zh: '每页结果数', en: 'Results per page' }, defaultValue: 20, min: 5, max: 50 },
        { key: 'search.include_products', type: 'switch', label: { zh: '包含商品', en: 'Include products' }, defaultValue: false }
      ]
    }
  ]
})

registerSettingsPage({
  id: 'rss',
  group: 'publishing',
  order: 24,
  icon: 'badge-check',
  title: { zh: 'RSS', en: 'RSS' },
  description: { zh: '订阅源输出选项。', en: 'Feed output options.' },
  sections: [
    {
      id: 'feed',
      title: { zh: '订阅源', en: 'Feed' },
      fields: [
        { key: 'rss.enabled', type: 'switch', label: { zh: '启用 RSS', en: 'Enable RSS' }, defaultValue: true },
        { key: 'rss.feed_title', type: 'text', label: { zh: '订阅源标题', en: 'Feed title' } },
        { key: 'rss.items_per_feed', type: 'number', label: { zh: '输出条数', en: 'Items per feed' }, defaultValue: 20, min: 5, max: 100 },
        { key: 'rss.include_full_content', type: 'switch', label: { zh: '输出全文', en: 'Include full content' }, defaultValue: false },
        { key: 'rss.include_featured_image', type: 'switch', label: { zh: '包含特色图片', en: 'Include featured image' }, defaultValue: true }
      ]
    }
  ]
})

registerSettingsPage({
  id: 'appearance',
  group: 'general',
  order: 11,
  icon: 'eye',
  title: { zh: '外观', en: 'Appearance' },
  description: { zh: '全局主题与品牌展示（不开放设计系统内部参数）。', en: 'Global theme and branding — no design-system internals.' },
  sections: [
    {
      id: 'theme',
      title: { zh: '主题', en: 'Theme' },
      fields: [
        {
          key: 'appearance.default_theme', type: 'select',
          label: { zh: '默认主题', en: 'Default theme' },
          description: { zh: '未手动选择时的配色模式。', en: 'Color mode used before the visitor picks one.' },
          defaultValue: 'system',
          options: [
            { value: 'system', label: { zh: '跟随系统', en: 'System' } },
            { value: 'light', label: { zh: '浅色', en: 'Light' } },
            { value: 'dark', label: { zh: '深色', en: 'Dark' } }
          ]
        },
        {
          key: 'appearance.allow_theme_switch', type: 'switch',
          label: { zh: '允许访客切换主题', en: 'Allow user theme switch' },
          defaultValue: true
        }
      ]
    },
    {
      id: 'layout',
      title: { zh: '布局', en: 'Layout' },
      fields: [
        {
          key: 'appearance.sidebar_enabled', type: 'switch',
          label: { zh: '显示侧边栏', en: 'Sidebar enabled' },
          description: { zh: '关闭后公开页面全宽显示。', en: 'Public pages render full width when off.' },
          defaultValue: true
        }
      ]
    }
  ]
})

registerSettingsPage({
  id: 'content',
  group: 'general',
  order: 12,
  icon: 'file-text',
  title: { zh: '内容', en: 'Content' },
  description: { zh: '默认发布行为与文章展示选项。', en: 'Default publishing behaviour and post display options.' },
  sections: [
    {
      id: 'posts',
      title: { zh: '文章', en: 'Posts' },
      fields: [
        {
          key: 'content.default_post_status', type: 'select',
          label: { zh: '新文章默认状态', en: 'Default post status' },
          defaultValue: 'draft',
          options: [
            { value: 'draft', label: { zh: '草稿', en: 'Draft' } },
            { value: 'published', label: { zh: '已发布', en: 'Published' } }
          ]
        },
        {
          key: 'content.show_reading_time', type: 'switch',
          label: { zh: '显示阅读时长', en: 'Show reading time' },
          defaultValue: true
        },
        {
          key: 'content.show_views', type: 'switch',
          label: { zh: '显示浏览量', en: 'Show views' },
          defaultValue: true
        },
        {
          key: 'content.excerpt_length', type: 'number',
          label: { zh: '摘要长度（字符）', en: 'Excerpt length (chars)' },
          defaultValue: 160, min: 40, max: 500
        }
      ]
    },
    {
      id: 'related',
      title: { zh: '相关内容', en: 'Related content' },
      fields: [
        {
          key: 'content.related_enabled', type: 'switch',
          label: { zh: '启用相关文章', en: 'Enable related posts' },
          defaultValue: true
        },
        {
          key: 'content.related_count', type: 'number',
          label: { zh: '相关文章数量', en: 'Related posts count' },
          defaultValue: 4, min: 1, max: 12,
          visibleWhen: { key: 'content.related_enabled', equals: true }
        }
      ]
    }
  ]
})

/* ---------------- S5: AI + Languages (§31-34) ---------------- */

registerSettingsPage({
  id: 'ai',
  group: 'ai',
  order: 40,
  icon: 'sparkles',
  title: { zh: 'AI', en: 'AI' },
  description: { zh: 'AI 功能开关与模型档位（Provider 与密钥在「AI 设置」页管理）。', en: 'AI feature switches and model tiers (providers & keys live in AI settings).' },
  sections: [
    {
      id: 'general',
      title: { zh: '常规', en: 'General' },
      fields: [
        { key: 'ai.enabled', type: 'switch', label: { zh: '启用 AI 功能', en: 'Enable AI features' }, defaultValue: true }
      ]
    },
    {
      id: 'models',
      title: { zh: '模型档位', en: 'Models' },
      description: { zh: '按用途选择模型；留空使用 Provider 默认模型。不要在这里填原始模型串以外的东西。', en: 'Pick a model per purpose; leave empty for the provider default.' },
      fields: [
        { key: 'ai.model.writing', type: 'text', label: { zh: '写作模型', en: 'Writing model' }, description: { zh: '编辑器改写/润色等写作任务。', en: 'Editor rewrite and polish tasks.' }, placeholder: { zh: '留空 = Provider 默认', en: 'empty = provider default' } },
        { key: 'ai.model.analysis', type: 'text', label: { zh: '分析模型', en: 'Analysis model' }, description: { zh: 'AI 助手与站点分析。', en: 'Assistant and site analysis.' }, placeholder: { zh: '留空 = Provider 默认', en: 'empty = provider default' } },
        { key: 'ai.model.vision', type: 'text', label: { zh: '视觉模型', en: 'Vision model' }, description: { zh: '截图理解（A4 阶段启用）。', en: 'Screenshot understanding (A4).' }, placeholder: { zh: '留空 = Provider 默认', en: 'empty = provider default' } },
        { key: 'ai.model.translation', type: 'text', label: { zh: '翻译模型', en: 'Translation model' }, placeholder: { zh: '留空 = Provider 默认', en: 'empty = provider default' } }
      ]
    },
    {
      id: 'features',
      title: { zh: '功能', en: 'Features' },
      fields: [
        { key: 'ai.feature_editor', type: 'switch', label: { zh: '编辑器 AI', en: 'Editor AI' }, defaultValue: true },
        { key: 'ai.feature_assistant', type: 'switch', label: { zh: 'AI 助手', en: 'AI Assistant' }, defaultValue: true },
        { key: 'ai.default_depth', type: 'select', label: { zh: '默认分析深度', en: 'Default analysis depth' }, defaultValue: 'balanced', options: [
          { value: 'quick', label: { zh: '快速', en: 'Quick' } },
          { value: 'balanced', label: { zh: '均衡', en: 'Balanced' } },
          { value: 'deep', label: { zh: '深入', en: 'Deep' } }
        ] }
      ]
    }
  ]
})

registerSettingsPage({
  id: 'languages',
  group: 'localization',
  order: 50,
  icon: 'globe',
  title: { zh: '语言', en: 'Languages' },
  description: { zh: '默认语言在此选择；语言列表与 URL 前缀在「语言注册表」管理。', en: 'Pick the default locale here; the locale list & URL prefixes live in the locale registry.' },
  sections: [
    {
      id: 'locales',
      title: { zh: '语言', en: 'Locales' },
      fields: [
        { key: 'localization.default_locale', type: 'select', label: { zh: '默认语言', en: 'Default language' }, optionsLoader: 'locales', description: { zh: '保存后该语言成为站点默认语言。', en: 'Saving makes this locale the site default.' } }
      ]
    }
  ]
})

/* ---------------- Friend Links settings (docs/友链.txt §62/63) ---------------- */

registerSettingsPage({
  id: 'friend-links',
  group: 'growth',
  order: 30,
  icon: 'link',
  title: { zh: '友情链接', en: 'Friend links' },
  description: { zh: '友链模块与申请审核策略（友链记录在「友情链接」管理页）。', en: 'Blogroll behaviour and review policy (records live in the Friend links manager).' },
  module: 'friend-links',
  sections: [
    {
      id: 'general',
      title: { zh: '常规', en: 'General' },
      fields: [
        { key: 'friend_links.enabled', type: 'switch', label: { zh: '启用友链', en: 'Enable friend links' }, defaultValue: true },
        { key: 'friend_links.submissions_enabled', type: 'switch', label: { zh: '开放申请', en: 'Allow submissions' }, defaultValue: true },
        { key: 'friend_links.backlink_policy', type: 'select', label: { zh: '反链策略', en: 'Backlink policy' }, description: { zh: 'recommended：自动检测并提供证据，但管理员仍可批准。', en: 'recommended: check and present evidence, but the admin may still approve.' }, defaultValue: 'recommended', options: [
          { value: 'none', label: { zh: '不检测', en: 'None' } },
          { value: 'recommended', label: { zh: '建议（检测不强制）', en: 'Recommended' } },
          { value: 'required', label: { zh: '必须（批准前须 found）', en: 'Required' } }
        ] }
      ]
    },
    {
      id: 'monitoring',
      title: { zh: '自动检测', en: 'Monitoring' },
      fields: [
        { key: 'friend_links.auto_check_backlink', type: 'switch', label: { zh: '定时反链检查', en: 'Scheduled backlink checks' }, defaultValue: true },
        { key: 'friend_links.auto_hide_broken', type: 'switch', label: { zh: '自动隐藏连续丢失的友链', en: 'Auto-hide links with lost backlinks' }, defaultValue: false }
      ]
    },
    {
      id: 'display',
      title: { zh: '展示', en: 'Display' },
      fields: [
        { key: 'friend_links.default_nofollow', type: 'switch', label: { zh: '默认 nofollow', en: 'Default nofollow' }, defaultValue: false },
        { key: 'friend_links.open_external_new_tab', type: 'switch', label: { zh: '外链新窗口打开', en: 'Open external links in new tab' }, defaultValue: true }
      ]
    }
  ]
})

registerSettingsPage({
  id: 'notifications',
  group: 'system',
  order: 60,
  icon: 'bell',
  title: { zh: '通知', en: 'Notifications' },
  description: { zh: '通知中心总开关与投递策略（渠道与订阅在「通知」模块管理）。', en: 'Master switches and delivery policy (channels & subscriptions live in the Notifications module).' },
  module: 'notifications',
  sections: [
    {
      id: 'delivery',
      title: { zh: '投递', en: 'Delivery' },
      fields: [
        { key: 'notifications.enabled', type: 'switch', label: { zh: '启用通知', en: 'Enable notifications' }, defaultValue: true },
        { key: 'notifications.allow_private_network', type: 'switch', label: { zh: '允许内网 Webhook 地址', en: 'Allow private webhook URLs' }, description: { zh: '自托管部署向内网推送时才开启，默认关闭（SSRF 防护）。', en: 'Only for self-hosted pushes into your own network — off by default (SSRF protection).' }, defaultValue: false }
      ]
    }
  ]
})
