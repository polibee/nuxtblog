/* Built-in ad slots (impl doc §2): boot seeds these into ad_slots so the
   admin can toggle them without a deploy. Page authors reference slots
   by key in <AdSlot name="...">. */

export const AD_SLOTS = [
  { key: 'sidebar-ad', name: '侧边栏广告位 / Sidebar ad' },
  { key: 'home-feed', name: '首页文章流 / Home feed' },
  { key: 'post-top', name: '文章顶部 / Post top' },
  { key: 'post-bottom', name: '文章底部 / Post bottom' },
  { key: 'footer-ad', name: '页脚广告位 / Footer ad' }
] as const

export type AdSlotKey = typeof AD_SLOTS[number]['key']
