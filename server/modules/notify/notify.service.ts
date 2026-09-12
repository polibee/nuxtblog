import { sendMail } from '../../utils/mail'

/* P16 notification templates: fire-and-forget. Mail failures must never
   break checkout/auth flows, so every send is best-effort and logged. */

const SITE = 'Blog Framework'

async function notify(to: string | null | undefined, subject: string, html: string): Promise<void> {
  if (!to || !to.includes('@')) return
  try {
    const result = await sendMail(to, subject, html)
    if (!result.ok) {
      console.error(`[mail] ${subject} -> ${to} failed:`, result.error)
    }
  } catch (error) {
    console.error(`[mail] ${subject} -> ${to} error:`, (error as Error).message)
  }
}

function wrap(title: string, bodyHtml: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
  <h2 style="color:#111">${title}</h2>
  <div style="color:#333;font-size:14px;line-height:1.6">${bodyHtml}</div>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
  <p style="color:#999;font-size:12px">${SITE} · 此邮件为系统自动发送，请勿直接回复</p>
</div>`
}

export function notifyOrderPaid(to: string | null | undefined, orderNumber: string, totalMinor: number, currency: string): void {
  const amount = (totalMinor / 100).toFixed(2)
  void notify(to, `订单支付成功 ${orderNumber}`, wrap('订单支付成功', `
    <p>您的订单 <b>${orderNumber}</b> 已支付成功（${currency} ${amount}）。</p>
    <p>虚拟商品将自动交付，可前往订单页查看卡密或会员状态。</p>`))
}

export function notifyOrderFailed(to: string | null | undefined, orderNumber: string): void {
  void notify(to, `订单未完成 ${orderNumber}`, wrap('订单未完成', `
    <p>您的订单 <b>${orderNumber}</b> 未完成支付（超时或已取消）。</p>
    <p>预占库存已释放，如需购买请重新下单。</p>`))
}

export function notifyOrderRefunded(to: string | null | undefined, orderNumber: string, amountMinor: number, currency: string): void {
  const amount = (amountMinor / 100).toFixed(2)
  void notify(to, `订单已退款 ${orderNumber}`, wrap('订单已退款', `
    <p>您的订单 <b>${orderNumber}</b> 已完成退款（${currency} ${amount}）。</p>
    <p>退款将原路返回，到账时间取决于支付渠道。</p>`))
}

export function notifyWelcome(to: string | null | undefined, name: string): void {
  void notify(to, `欢迎加入 ${SITE}`, wrap('注册成功', `
    <p>${name ? `<b>${name}</b>，` : ''}欢迎加入 ${SITE}！</p>
    <p>您的账号已创建成功，现在可以下单购买并查阅会员与付费内容。</p>`))
}
