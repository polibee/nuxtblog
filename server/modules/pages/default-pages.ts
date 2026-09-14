import { isBlogDbReady } from '../../repositories/db.server'
import { createPage, getPublicPageByAlias } from './page.service'

/* P16 generic pages: seed privacy policy / terms of use / about so a new
   install ships with usable content. Idempotent — checks by alias first
   and never overwrites admin edits. */

interface SeedPage {
  alias: string
  title: string
  content: string
  template: string
  enTitle?: string
  enContent?: string
}

const SEED_PAGES: SeedPage[] = [
  {
    alias: 'privacy-policy',
    title: '隐私政策 Privacy Policy',
    template: 'privacy',
    enTitle: 'Privacy Policy',
    enContent: '<p>We collect only the information needed to operate accounts, orders, comments, and site services.</p><h2>Information we collect</h2><p>Registration, purchases, and comments may require an email address, order details, and limited security logs.</p><h2>How we use it</h2><p>Information is used for sign-in, payment processing, content delivery, moderation, and service notices.</p><h2>Your choices</h2><p>You may contact the administrator to export, correct, or delete personal data.</p>',
    content: `<p>我们只收集运行账号、订单、评论和站点服务所必需的信息。</p>
<h2>我们收集的信息</h2><p>注册、购买或评论时，可能会保存邮箱、订单信息和必要的安全日志。</p>
<h2>信息如何使用</h2><p>这些信息用于登录、支付处理、内容交付、评论审核和服务通知，不会用于无关的用途。</p>
<h2>保留与删除</h2><p>我们会在业务需要的期限内保留数据。您可以联系管理员申请导出、更正或删除个人数据。</p>`
  },
  {
    alias: 'terms-of-use',
    title: '使用条款 Terms of Use',
    template: 'terms',
    enTitle: 'Terms of Use',
    enContent: '<p>Welcome to the site, community, and digital services. By continuing to use them, you agree to these terms.</p><h2>Content and accounts</h2><p>Please use lawful content and keep your account credentials secure.</p><h2>Purchases and refunds</h2><p>Digital goods are delivered after successful payment. Include your order number when reporting a delivery or quality issue.</p><h2>Liability</h2><p>Site content is provided as-is and is not professional advice.</p>',
    content: `<p>欢迎使用本站内容、社区和数字商品服务。继续访问或购买即表示您同意以下约定。</p>
<h2>内容与账号</h2><p>请使用真实、合法且不侵犯他人权益的内容。账号持有人应妥善保管登录凭据。</p>
<h2>购买与退款</h2><p>数字商品在支付成功后按商品说明交付。遇到交付或质量问题，请通过站点联系方式提交订单号。</p>
<h2>责任范围</h2><p>本站内容按现状提供，文章观点不构成专业建议。我们会努力保持服务稳定，但不承诺永不中断。</p>`
  },
  {
    alias: 'about',
    title: '关于本站 About',
    template: 'about',
    enTitle: 'About this site',
    enContent: '<p>NuxtBlog is a content-first personal site where articles, projects, links, and digital services live together.</p><h2>What you can find here</h2><p>Read independent articles, browse topics, explore the author profile, and discover digital products.</p><h2>Always evolving</h2><p>This is a living workshop. Pages, navigation, and content are maintained independently from the admin panel.</p>',
    content: `<p>NuxtBlog 是一个以内容为中心的个人站点：文章、作品、链接和数字服务都在同一个清晰的空间里呈现。</p>
<h2>这里有什么</h2><p>你可以阅读独立文章、浏览分类、查看作者资料，也可以通过商城和会员模块探索数字产品。</p>
<h2>持续更新</h2><p>这是一个可持续迭代的实验场。页面、导航和内容都可以在后台管理中独立维护。</p>`
  },
  {
    alias: 'friends',
    title: '友情链接',
    template: 'friend_links',
    content: `<p>这里收录本站认可的独立网站与创作者。欢迎维护原创内容、长期更新的网站申请交换链接。</p>
<p>页面下方包含本站信息与申请友链表单，具体友链数据由后台「友链」模块统一维护。</p>`
  }
]

/** seed the generic pages once (idempotent, non-destructive) */
export async function ensureDefaultPages(): Promise<void> {
  if (!isBlogDbReady()) return
  for (const seed of SEED_PAGES) {
    const existing = await getPublicPageByAlias('zh-CN', seed.alias)
    if (existing) continue
    try {
      await createPage({
        alias: seed.alias,
        status: 'published',
        template: seed.template ?? 'default',
        translations: {
          'zh-CN': { title: seed.title, content: seed.content },
          ...(seed.enTitle && seed.enContent
            ? { en: { title: seed.enTitle, content: seed.enContent } }
            : {})
        }
      }, 1)
    } catch (e) {
      console.error('[default-pages] seed ' + seed.alias + ' failed:', (e as Error).message)
    }
  }
}
