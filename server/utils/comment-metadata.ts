import { createHash } from 'node:crypto'

export interface CommentMetadata {
  browserName: string | null
  browserVersion: string | null
  osName: string | null
  osVersion: string | null
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown'
}

const EMPTY_METADATA: CommentMetadata = {
  browserName: null,
  browserVersion: null,
  osName: null,
  osVersion: null,
  deviceType: 'unknown'
}

function matchVersion(userAgent: string, expression: RegExp): string | null {
  return userAgent.match(expression)?.[1] ?? null
}

export function parseCommentMetadata(userAgent: string): CommentMetadata {
  if (!userAgent) return { ...EMPTY_METADATA }

  const isIPhone = /iPhone|iPod/i.test(userAgent)
  const isIPad = /iPad/i.test(userAgent)
  const isAndroid = /Android/i.test(userAgent)

  let osName: string | null = null
  let osVersion: string | null = null
  const iosMatch = matchVersion(userAgent, /(?:CPU (?:iPhone )?OS|iPhone OS) ([\d_]+)/i)
  const iosVersion = iosMatch?.replace(/_/g, '.') ?? null
  const androidVersion = matchVersion(userAgent, /Android[ /-]([\d.]+)/i)
  const windowsVersion = matchVersion(userAgent, /Windows NT ([\d.]+)/i)
  const macVersion = matchVersion(userAgent, /Mac OS X ([\d_]+)/i)?.replace(/_/g, '.')

  if (isIPhone || isIPad || iosVersion) {
    osName = 'iOS'
    osVersion = iosVersion
  } else if (androidVersion) {
    osName = 'Android'
    osVersion = androidVersion
  } else if (windowsVersion) {
    osName = 'Windows'
    osVersion = ({ '10.0': '10', '6.4': '10', '6.3': '8.1', '6.2': '8', '6.1': '7' } as Record<string, string>)[windowsVersion] ?? windowsVersion
  } else if (macVersion) {
    osName = 'macOS'
    osVersion = macVersion
  } else if (/Linux/i.test(userAgent)) {
    osName = 'Linux'
  }

  let browserName: string | null = null
  let browserVersion: string | null = null
  const browserMatchers: Array<[string, RegExp]> = [
    ['Edge', /Edg(?:e|A|iOS)?\/([\d.]+)/i],
    ['Opera', /(?:OPR|Opera)\/([\d.]+)/i],
    ['Samsung Internet', /SamsungBrowser\/([\d.]+)/i],
    ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/i],
    ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/i],
    ['Safari', /Version\/([\d.]+).*Safari\//i],
    ['Internet Explorer', /(?:MSIE\s|rv:)([\d.]+)/i]
  ]
  for (const [name, matcher] of browserMatchers) {
    const version = matchVersion(userAgent, matcher)
    if (version) {
      browserName = name
      browserVersion = version
      break
    }
  }

  const deviceType = isIPad || (isAndroid && !/Mobile/i.test(userAgent))
    ? 'tablet'
    : isIPhone || /iPod|Windows Phone|Mobile/i.test(userAgent)
      ? 'mobile'
      : osName
        ? 'desktop'
        : 'unknown'

  return { browserName, browserVersion, osName, osVersion, deviceType }
}

export function gravatarHash(email: string): string {
  return createHash('md5').update(email.trim().toLowerCase()).digest('hex')
}
