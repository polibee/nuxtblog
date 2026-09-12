/* Built-in ad slots (impl doc §2): boot seeds these into ad_slots so the
   admin can toggle them without a deploy. Page authors reference slots
   by key in <AdSlot name="...">. */

export const AD_SLOTS = [
  { key: 'sidebar-ad', name: '侧边栏广告位 / Sidebar ad' },
  { key: 'post-bottom', name: '文章底部广告位 / Post bottom ad' }
] as const

export type AdSlotKey = typeof AD_SLOTS[number]['key']
