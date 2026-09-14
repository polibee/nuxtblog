import { describe, expect, it } from 'vitest'
import { channelDeleteErrorMessage, channelDeleteMessage } from '../../shared/utils/notification-channel'

describe('notification channel deletion feedback', () => {
  it('explains that channels with delivery history are disabled', () => {
    expect(channelDeleteMessage('disabled')).toContain('停用')
    expect(channelDeleteMessage('disabled')).toContain('历史日志')
  })

  it('explains subscription conflicts instead of showing a generic save error', () => {
    expect(channelDeleteErrorMessage(409, 'Delete its subscriptions first')).toContain('事件订阅')
  })
})
