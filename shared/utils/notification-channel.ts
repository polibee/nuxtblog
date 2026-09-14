export type ChannelDeleteAction = 'deleted' | 'disabled'

export function channelDeleteMessage(action: ChannelDeleteAction): string {
  return action === 'disabled'
    ? '该渠道已有投递记录，已停用以保留历史日志。'
    : '通知渠道已删除。'
}

export function channelDeleteErrorMessage(statusCode: number | undefined, message: string): string {
  if (statusCode === 409 && /subscription/i.test(message)) return '该渠道仍有事件订阅，请先删除或改绑订阅。'
  if (statusCode === 409 && /delivery history/i.test(message)) return '该渠道已有投递记录，系统会停用渠道并保留历史日志。'
  return message || '通知渠道删除失败，请稍后重试。'
}
