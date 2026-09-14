import { readdir, readFile } from 'node:fs/promises'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ADMIN_I18N_DYNAMIC_KEY_ALLOWLIST,
  ADMIN_I18N_HARDCODED_COPY_ALLOWLIST
} from '../app/admin/i18n/display-label.ts'

export interface SourceLocation {
  file: string
  line: number
  column: number
}

export interface StaticKeyUsage extends SourceLocation {
  functionName: 't' | '$t'
  key: string
}

export interface DynamicKeyRisk extends SourceLocation {
  expression: string
  functionName: 't' | '$t'
  reason: string
}

export interface RawKeyRisk extends SourceLocation {
  key: string
}

export interface HardcodedCopyRisk extends SourceLocation {
  text: string
}

export interface LocaleDiff {
  locale: string
  missing: string[]
  extra: string[]
}

export interface I18nAuditReport {
  staticUsages: StaticKeyUsage[]
  missingKeys: string[]
  localeDiffs: LocaleDiff[]
  dynamicKeyRisks: DynamicKeyRisk[]
  rawKeyRisks: RawKeyRisk[]
  hardcodedCopyRisks: HardcodedCopyRisk[]
  findings: Array<{
    kind: 'missing-key' | 'locale-missing' | 'locale-extra' | 'dynamic-key' | 'raw-key' | 'hardcoded-copy'
    message: string
    file?: string
    line?: number
    column?: number
    key?: string
    locale?: string
  }>
  hasErrors: boolean
}

export interface AuditOptions {
  rootDir?: string
  sourceDirs?: string[]
  localeDir?: string
  locales?: string[]
  /** Map the exact first argument expression to the finite keys it can produce. */
  dynamicKeyAllowlist?: Record<string, string[]>
  /** Exact template text intentionally kept as a technical identifier. */
  hardcodedCopyAllowlist?: readonly string[]
}

interface SourceFile {
  relativePath: string
  content: string
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.vue'])
const LOCALE_EXTENSIONS = new Set(['.ts', '.js', '.json'])
const DEFAULT_SOURCE_DIRS = ['app/components', 'app/modules', 'app/admin']
const DEFAULT_LOCALES = ['zh-CN', 'en']
const DOUBLE_QUOTE = String.fromCharCode(34)
const CALL_PATTERN = /(^|[^\w$])(\$?t)\s*\(/gu
const LOCALE_KEY_PATTERN = /(?:^|[,{]\s*)['"]([^'"]+)['"]\s*:/gmu
const RAW_KEY_PATTERN = /\{\{\s*(['"`])([^'"`]+)\1\s*\}\}/gu
const TAINTED_DYNAMIC_PATTERN = /\b(?:userInput|user_input|input|query|request|route|searchParams|params)\b/iu

async function listFiles(rootDir: string, directory: string, extensions: Set<string>): Promise<string[]> {
  const absoluteDirectory = resolve(rootDir, directory)
  let entries
  try {
    entries = await readdir(absoluteDirectory, { withFileTypes: true })
  } catch {
    return []
  }

  const files: string[] = []
  for (const entry of entries) {
    const absolutePath = resolve(absoluteDirectory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFiles(rootDir, relative(rootDir, absolutePath), extensions))
    } else if (entry.isFile() && extensions.has(extname(entry.name))) {
      files.push(absolutePath)
    }
  }
  return files.sort()
}

async function readSourceFiles(rootDir: string, directories: string[], extensions: Set<string>): Promise<SourceFile[]> {
  const paths = (await Promise.all(directories.flatMap(directory => listFiles(rootDir, directory, extensions)))).flat()
  return Promise.all(paths.map(async absolutePath => ({
    relativePath: relative(rootDir, absolutePath).replaceAll('\\', '/'),
    content: await readFile(absolutePath, 'utf8')
  })))
}

function locationAt(content: string, index: number, file: string): SourceLocation {
  const before = content.slice(0, index)
  const line = before.split('\n').length
  const lineStart = before.lastIndexOf('\n') + 1
  return { file, line, column: index - lineStart + 1 }
}

function firstArgument(content: string, openParenIndex: number): { expression: string, end: number } | undefined {
  let index = openParenIndex + 1
  while (/\s/u.test(content[index] ?? '')) index += 1
  const start = index
  let quote: string | undefined
  let escaped = false
  let depth = 0

  for (; index < content.length; index += 1) {
    const character = content[index]!
    if (quote) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = undefined
      }
      continue
    }

    if (character === String.fromCharCode(39) || character === DOUBLE_QUOTE || character === String.fromCharCode(96)) {
      quote = character
    } else if (character === '(' || character === '[' || character === '{') {
      depth += 1
    } else if (character === ')' || character === ']' || character === '}') {
      if (depth === 0) return { expression: content.slice(start, index).trim(), end: index }
      depth -= 1
    } else if (character === ',' && depth === 0) {
      return { expression: content.slice(start, index).trim(), end: index }
    }
  }

  return undefined
}

function decodeStaticExpression(expression: string): string | undefined {
  const quote = expression[0]
  if (!quote || ![DOUBLE_QUOTE, String.fromCharCode(39), String.fromCharCode(96)].includes(quote) || expression.at(-1) !== quote) return undefined
  const value = expression.slice(1, -1)
  if (quote === '`' && value.includes('${')) return undefined
  return value.replaceAll('\\' + quote, quote).replaceAll('\\\\', '\\')
}

function isFunctionDeclaration(content: string, callStart: number): boolean {
  return /\bfunction\s*$/u.test(content.slice(Math.max(0, callStart - 30), callStart))
}

function scanCalls(sourceFile: SourceFile): {
  staticUsages: StaticKeyUsage[]
  dynamicKeyRisks: DynamicKeyRisk[]
} {
  const staticUsages: StaticKeyUsage[] = []
  const dynamicKeyRisks: DynamicKeyRisk[] = []

  for (const match of sourceFile.content.matchAll(CALL_PATTERN)) {
    const functionName = match[2] as 't' | '$t'
    const tokenStart = (match.index ?? 0) + (match[1]?.length ?? 0)
    if (isFunctionDeclaration(sourceFile.content, tokenStart)) continue
    const openParenIndex = (match.index ?? 0) + match[0].lastIndexOf('(')
    const argument = firstArgument(sourceFile.content, openParenIndex)
    if (!argument || !argument.expression) continue

    const location = locationAt(sourceFile.content, tokenStart, sourceFile.relativePath)
    const key = decodeStaticExpression(argument.expression)
    if (key !== undefined) {
      staticUsages.push({ ...location, functionName, key })
      continue
    }

    dynamicKeyRisks.push({
      ...location,
      functionName,
      expression: argument.expression,
      reason: TAINTED_DYNAMIC_PATTERN.test(argument.expression)
        ? 'Dynamic i18n key may include user input and cannot be concatenated.'
        : 'Dynamic i18n key is not covered by an explicit whitelist mapping.'
    })
  }

  return { staticUsages, dynamicKeyRisks }
}

function extractLocaleKeys(content: string): Set<string> {
  return new Set([...content.matchAll(LOCALE_KEY_PATTERN)].map(match => match[1]!))
}

function hasIgnoredRawKeyContext(content: string, index: number): boolean {
  const lineStart = content.lastIndexOf('\n', index) + 1
  const lineEnd = content.indexOf('\n', index)
  const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd)
  return /(?:data-)?permission(?:[-\w]*code)?\s*=|\b(?:api|field|column|database|db)(?:[-\w]*name|[-\w]*field|[-\w]*column)?\b/iu.test(line)
}

function scanRawKeys(sourceFile: SourceFile, knownKeys: Set<string>): RawKeyRisk[] {
  if (!sourceFile.relativePath.endsWith('.vue')) return []
  const risks: RawKeyRisk[] = []
  for (const match of sourceFile.content.matchAll(RAW_KEY_PATTERN)) {
    const key = match[2]!
    const index = match.index ?? 0
    if (knownKeys.has(key) && !hasIgnoredRawKeyContext(sourceFile.content, index)) {
      risks.push({ ...locationAt(sourceFile.content, index, sourceFile.relativePath), key })
    }
  }
  return risks
}

function blank(value: string): string {
  return value.replace(/[^\n]/gu, ' ')
}

function maskTemplateTags(content: string): string {
  let output = ''
  let inTag = false
  let quote: string | undefined

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]!
    if (!inTag) {
      if (character === '<' && /[A-Za-z!?/]/u.test(content[index + 1] ?? '')) {
        inTag = true
        output += ' '
      } else {
        output += character
      }
      continue
    }

    output += character === '\n' ? '\n' : ' '
    if (quote) {
      if (character === quote) quote = undefined
    } else if (character === DOUBLE_QUOTE || character === String.fromCharCode(39)) {
      quote = character
    } else if (character === '>') {
      inTag = false
    }
  }

  return output
}

function templateTextOnly(content: string): string {
  const withoutNonTemplateContent = content
    .replace(/<!--[\s\S]*?-->/gu, blank)
    .replace(/<script\b[\s\S]*?<\/script\s*>/giu, blank)
    .replace(/<style\b[\s\S]*?<\/style\s*>/giu, blank)
    .replace(/\{\{[\s\S]*?\}\}/gu, blank)
  return maskTemplateTags(withoutNonTemplateContent)
}

function isHardcodedCopy(text: string): boolean {
  return /[\u3400-\u9fff]/u.test(text) || /[A-Za-z]{2,}/u.test(text)
}

function scanHardcodedCopy(sourceFile: SourceFile, allowlist: Set<string>): HardcodedCopyRisk[] {
  if (!sourceFile.relativePath.endsWith('.vue')) return []
  const visibleTemplate = templateTextOnly(sourceFile.content)
  const risks: HardcodedCopyRisk[] = []
  const textPattern = /[^\n<>]*[^\s<>][^\n<>]*/gu
  for (const match of visibleTemplate.matchAll(textPattern)) {
    const text = match[0]!.replace(/\s+/gu, ' ').trim()
    if (text && isHardcodedCopy(text) && !allowlist.has(text)) {
      risks.push({ ...locationAt(sourceFile.content, match.index ?? 0, sourceFile.relativePath), text })
    }
  }
  return risks
}

function compareLocaleKeys(localeKeys: Map<string, Set<string>>): LocaleDiff[] {
  const locales = [...localeKeys.keys()].sort()
  const allKeys = new Set([...localeKeys.values()].flatMap(keys => [...keys]))
  return locales.map((locale) => {
    const keys = localeKeys.get(locale) ?? new Set<string>()
    return {
      locale,
      missing: [...allKeys].filter(key => !keys.has(key)).sort(),
      extra: [...keys].filter(key => locales.some(other => other !== locale && localeKeys.get(other)?.has(key) !== true)).sort()
    }
  }).filter(diff => diff.missing.length > 0 || diff.extra.length > 0)
}

function buildFindings(report: Omit<I18nAuditReport, 'findings' | 'hasErrors'>): I18nAuditReport['findings'] {
  const findings: I18nAuditReport['findings'] = []
  for (const usage of report.staticUsages) {
    if (report.missingKeys.includes(usage.key)) {
      findings.push({
        kind: 'missing-key',
        message: `Missing i18n key: ${usage.key}`,
        ...usage,
        key: usage.key
      })
    }
  }
  for (const diff of report.localeDiffs) {
    for (const key of diff.missing) findings.push({ kind: 'locale-missing', message: `${diff.locale} is missing ${key}`, locale: diff.locale, key })
    for (const key of diff.extra) findings.push({ kind: 'locale-extra', message: `${diff.locale} has extra key ${key}`, locale: diff.locale, key })
  }
  findings.push(...report.dynamicKeyRisks.map(risk => ({ kind: 'dynamic-key' as const, message: risk.reason, ...risk })))
  findings.push(...report.rawKeyRisks.map(risk => ({ kind: 'raw-key' as const, message: `Template outputs raw i18n key: ${risk.key}`, ...risk })))
  findings.push(...report.hardcodedCopyRisks.map(risk => ({ kind: 'hardcoded-copy' as const, message: `Hardcoded template copy: ${risk.text}`, ...risk })))
  return findings
}

export async function auditI18nUsage(options: AuditOptions = {}): Promise<I18nAuditReport> {
  const rootDir = resolve(options.rootDir ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'))
  const sourceFiles = await readSourceFiles(rootDir, options.sourceDirs ?? DEFAULT_SOURCE_DIRS, SOURCE_EXTENSIONS)
  const localeDir = options.localeDir ?? 'app/i18n/locales'
  const locales = options.locales ?? DEFAULT_LOCALES
  const localeFiles = await Promise.all(locales.map(async locale => ({
    locale,
    files: await readSourceFiles(rootDir, [resolve(rootDir, localeDir, locale)], LOCALE_EXTENSIONS)
  })))
  const localeKeys = new Map(localeFiles.map(({ locale, files }) => [locale, new Set(files.flatMap(file => [...extractLocaleKeys(file.content)]))]))
  const knownKeys = new Set([...localeKeys.values()].flatMap(keys => [...keys]))
  const hardcodedCopyAllowlist = new Set(options.hardcodedCopyAllowlist ?? [])
  const scannedCalls = sourceFiles.reduce((result, sourceFile) => {
    const calls = scanCalls(sourceFile)
    result.staticUsages.push(...calls.staticUsages)
    for (const risk of calls.dynamicKeyRisks) {
      const allowedKeys = options.dynamicKeyAllowlist?.[risk.expression]
      if (allowedKeys && !TAINTED_DYNAMIC_PATTERN.test(risk.expression) && !risk.expression.includes('+') && allowedKeys.length > 0) continue
      result.dynamicKeyRisks.push(risk)
    }
    result.rawKeyRisks.push(...scanRawKeys(sourceFile, knownKeys))
    result.hardcodedCopyRisks.push(...scanHardcodedCopy(sourceFile, hardcodedCopyAllowlist))
    return result
  }, {
    staticUsages: [] as StaticKeyUsage[],
    dynamicKeyRisks: [] as DynamicKeyRisk[],
    rawKeyRisks: [] as RawKeyRisk[],
    hardcodedCopyRisks: [] as HardcodedCopyRisk[]
  })
  const missingKeys = [...new Set(scannedCalls.staticUsages.map(usage => usage.key).filter(key => !knownKeys.has(key)))].sort()
  const partialReport = {
    staticUsages: scannedCalls.staticUsages,
    missingKeys,
    localeDiffs: compareLocaleKeys(localeKeys),
    dynamicKeyRisks: scannedCalls.dynamicKeyRisks,
    rawKeyRisks: scannedCalls.rawKeyRisks,
    hardcodedCopyRisks: scannedCalls.hardcodedCopyRisks
  }
  const findings = buildFindings(partialReport)
  return { ...partialReport, findings, hasErrors: findings.length > 0 }
}

export function formatAuditReport(report: I18nAuditReport): string {
  const lines = [
    `i18n usage audit: ${report.hasErrors ? 'FAILED' : 'PASSED'}`,
    `Static keys: ${report.staticUsages.length}`,
    `Findings: ${report.findings.length}`
  ]
  const groups: Array<[string, I18nAuditReport['findings']]> = [
    ['Missing keys', report.findings.filter(finding => finding.kind === 'missing-key')],
    ['Locale differences', report.findings.filter(finding => finding.kind === 'locale-missing' || finding.kind === 'locale-extra')],
    ['Dynamic key risks', report.findings.filter(finding => finding.kind === 'dynamic-key')],
    ['Raw key risks', report.findings.filter(finding => finding.kind === 'raw-key')],
    ['Hardcoded template copy', report.findings.filter(finding => finding.kind === 'hardcoded-copy')]
  ]
  for (const [title, findings] of groups) {
    if (findings.length === 0) continue
    lines.push('', `${title}:`)
    for (const finding of findings) {
      const location = finding.file ? `${finding.file}:${finding.line}:${finding.column} ` : ''
      lines.push(`- ${location}${finding.message}`)
    }
  }
  return lines.join('\n')
}

const scriptPath = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const report = await auditI18nUsage({
    dynamicKeyAllowlist: ADMIN_I18N_DYNAMIC_KEY_ALLOWLIST,
    hardcodedCopyAllowlist: ADMIN_I18N_HARDCODED_COPY_ALLOWLIST
  })
  console.log(formatAuditReport(report))
  process.exitCode = report.hasErrors ? 1 : 0
}
