import { isBlogDbReady } from '../../repositories/db.server'
import { createPage, getPublicPageByAlias } from './page.service'

/* P16 generic pages: seed privacy policy / terms of use / about so a new
   install ships with usable content. Idempotent — checks by alias first
   and never overwrites admin edits. */

interface SeedPage {
  alias: string
  title: string
  content: string
}

const SEED_PAGES: SeedPage[] = [
  {
    alias: 'privacy-policy',
    title: '隐私政策 Privacy Policy',
    content: `<h2>我们收集哪些信息</h2>
<p>在您注册账号、下单购买或提交评论时，我们会收集您的邮箱地址与必要的订单信息。我们不会收集任何不必要的个人数据。</p>
<h2>数据用途</h2>
<p>收集的信息仅用于：账号管理、订单与支付处理、交付虚拟商品、发送与服务相关的邮件通知。</p>
<h2>数据留存</h2>
<p>分析类原始事件默认保留 90 天，聚合统计数据保留 24 个月。账号数据在您请求注销前一直保留。</p>
<h2>您的权利</h2>
<p>您可以随时联系我们导出或删除您的个人数据。</p>`
  },
  {
    alias: 'terms-of-use',
    title: '使用条款 Terms of Use',
    content: `<h2>服务说明</h2>
<p>本站提供博客内容与虚拟商品（卡密、会员计划等）。虚拟商品在支付成功后自动交付。</p>
<h2>购买与退款</h2>
<p>虚拟商品一经交付，除商品本身存在无法使用等质量问题外，一般不支持无理由退款。如有问题请通过页面联系方式与我们沟通。</p>
<h2>免责声明</h2>
<p>本站内容按"现状"提供。对于因使用本站内容而产生的任何直接或间接损失，我们不承担责任。</p>`
  },
  {
    alias: 'about',
    title: '关于本站 About',
    content: `<p>这是一个基于 NuxtAdmin 构建的博客框架演示站点，内置多语言内容、商城与会员体系。</p>
<p>本页面为通用页面（Page），您可以在后台「页面」中编辑或新建类似页面。</p>`
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
        template: 'default',
        translations: {
          'zh-CN': {
            title: seed.title,
            content: seed.content
          }
        }
      }, 1)
    } catch (e) {
      console.error('[default-pages] seed ' + seed.alias + ' failed:', (e as Error).message)
    }
  }
}
