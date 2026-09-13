/** Public post UI translations. Article fields remain content data. */
export const zhPosts = {
  'posts.empty': '暂无文章。',
  'posts.meta.readingTime': '{n} 分钟阅读',
  'posts.meta.views': '{n} 次浏览',
  'posts.meta.comments': '{n} 条评论',
  'posts.actions.open': '打开文章：{title}',
  'posts.actions.buyFor': '购买全文 · {price}',
  'posts.labels.tags': '标签',
  'posts.access.paidLocked': '本文为付费内容，以下部分需要购买后阅读。',
  'posts.access.membersOnly': '本文为会员专属内容，购买会员后即可阅读。',
  'posts.errors.orderFailed': '下单失败，请稍后重试。'
} satisfies Record<string, string>

export default zhPosts
