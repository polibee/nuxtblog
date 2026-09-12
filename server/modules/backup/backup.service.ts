import AdmZip from 'adm-zip'
import { desc } from 'drizzle-orm'
import type { MySqlTable } from 'drizzle-orm/mysql-core'
import { getDb, isBlogDbReady } from '../../repositories/db.server'
import * as schema from '../../repositories/schema/exports-all'
import { listLocales } from '../../repositories/locale.repository'

/* P14 Full Site Backup (docs/新建 文本文档.txt §2-25).
   Provider registry: each aggregate declares its tables, FK remaps and
   date columns; the engine exports table rows to JSON files inside a
   ZIP with a manifest, and restores them inside one transaction with
   ID remapping (Replace mode). Financial/analytics tables are not
   backed up; secrets are redacted. */

export const BACKUP_FORMAT = 'nuxt-blog-backup'
export const BACKUP_VERSION = '1.0'

interface TableSpec {
  key: string
  table: MySqlTable
  /** FK columns remapped through the ID mapping of another provider */
  remap?: Record<string, string>
  /** composite-key table: no auto id, no id mapping */
  noId?: boolean
  /** self-referencing columns remapped within the same table */
  selfRef?: string[]
  /** date columns converted from ISO strings on restore */
  dates?: string[]
  /** id columns to preserve verbatim (no remap) */
  keepId?: boolean
}

const D = ['createdAt', 'updatedAt']

export const TABLE_SPECS: TableSpec[] = [
  { key: 'locales', table: schema.locales, dates: D },
  { key: 'users', table: schema.users, dates: D },
  { key: 'media-folders', table: schema.mediaFolders, dates: ['createdAt'] },
  { key: 'media', table: schema.media, remap: { folderId: 'media-folders' }, dates: D },
  { key: 'media-translations', table: schema.mediaTranslations, remap: { mediaId: 'media', localeId: 'locales' }, dates: D },
  { key: 'media-variants', table: schema.mediaVariants, remap: { mediaId: 'media' }, dates: ['createdAt'] },
  { key: 'settings', table: schema.settings, dates: D },
  { key: 'localized-settings', table: schema.localizedSettings, remap: { localeId: 'locales' }, dates: ['updatedAt'] },
  { key: 'categories', table: schema.categories, dates: D },
  { key: 'category-translations', table: schema.categoryTranslations, remap: { entityId: 'categories', localeId: 'locales' }, dates: D },
  { key: 'tags', table: schema.tags, dates: D },
  { key: 'tag-translations', table: schema.tagTranslations, remap: { entityId: 'tags', localeId: 'locales' }, dates: D },
  { key: 'posts', table: schema.posts, remap: { authorId: 'users', primaryLocaleId: 'locales' }, dates: D },
  { key: 'post-translations', table: schema.postTranslations, remap: { postId: 'posts', localeId: 'locales', featuredImageId: 'media' }, dates: D },
  { key: 'post-categories', table: schema.postCategories, remap: { postId: 'posts', categoryId: 'categories' }, noId: true },
  { key: 'post-tags', table: schema.postTags, remap: { postId: 'posts', tagId: 'tags' }, noId: true },
  { key: 'pages', table: schema.pages, remap: { authorId: 'users', primaryLocaleId: 'locales' }, dates: D },
  { key: 'page-translations', table: schema.pageTranslations, remap: { pageId: 'pages', localeId: 'locales' }, dates: D },
  { key: 'navigations', table: schema.navigations, dates: D },
  { key: 'navigation-variants', table: schema.navigationVariants, remap: { navigationId: 'navigations', localeId: 'locales' }, dates: D },
  { key: 'navigation-items', table: schema.navigationItems, remap: { navigationVariantId: 'navigation-variants' }, selfRef: ['parentId'], dates: D },
  { key: 'navigation-item-translations', table: schema.navigationItemTranslations, remap: { itemId: 'navigation-items', localeId: 'locales' }, dates: D },
  { key: 'sidebar-cards', table: schema.sidebarCards, dates: D },
  { key: 'sidebar-card-translations', table: schema.sidebarCardTranslations, remap: { cardId: 'sidebar-cards', localeId: 'locales' }, dates: D },
  { key: 'comments', table: schema.comments, remap: { postId: 'posts' }, selfRef: ['parentId'], dates: D },
  { key: 'products', table: schema.products, remap: { primaryLocaleId: 'locales', createdBy: 'users' }, dates: D },
  { key: 'product-translations', table: schema.productTranslations, remap: { productId: 'products', localeId: 'locales' }, dates: D },
  { key: 'product-prices', table: schema.productPrices, remap: { productId: 'products' }, dates: D },
  { key: 'inventory-batches', table: schema.inventoryBatches, remap: { productId: 'products', createdBy: 'users' }, dates: D },
  { key: 'inventory-items', table: schema.inventoryItems, remap: { batchId: 'inventory-batches', orderId: 'orders' }, dates: D },
  { key: 'membership-plans', table: schema.membershipPlans, dates: D },
  { key: 'membership-plan-translations', table: schema.membershipPlanTranslations, remap: { entityId: 'membership-plans', localeId: 'locales' }, dates: D },
  { key: 'subscriptions', table: schema.subscriptions, remap: { userId: 'users', planId: 'membership-plans' }, dates: D },
  { key: 'post-purchases', table: schema.postPurchases, remap: { postId: 'posts', userId: 'users' }, dates: ['purchasedAt'] },
  { key: 'ad-slots', table: schema.adSlots, dates: D },
  { key: 'ad-campaigns', table: schema.adCampaigns, remap: { orderId: 'orders' }, dates: D },
  { key: 'ad-creatives', table: schema.adCreatives, remap: { campaignId: 'ad-campaigns' }, dates: D },
  { key: 'ad-creative-translations', table: schema.adCreativeTranslations, remap: { creativeId: 'ad-creatives', localeId: 'locales', imageId: 'media' }, dates: D },
  { key: 'ad-placements', table: schema.adPlacements, remap: { campaignId: 'ad-campaigns' }, dates: ['createdAt'] },
  { key: 'sliders', table: schema.sliders, dates: D },
  { key: 'slider-items', table: schema.sliderItems, remap: { sliderId: 'sliders', imageMediaId: 'media', mobileImageMediaId: 'media' }, dates: D },
  { key: 'slider-item-translations', table: schema.sliderItemTranslations, remap: { sliderItemId: 'slider-items', localeId: 'locales' }, dates: D },
  { key: 'friend-link-categories', table: schema.friendLinkCategories, dates: ['createdAt'] },
  { key: 'friend-link-category-translations', table: schema.friendLinkCategoryTranslations, remap: { categoryId: 'friend-link-categories', localeId: 'locales' }, dates: ['createdAt'] },
  { key: 'friend-link-submissions', table: schema.friendLinkSubmissions, remap: { reviewerId: 'users' }, dates: [...D, 'backlinkCheckedAt', 'reviewedAt'] },
  { key: 'friend-links', table: schema.friendLinks, remap: { categoryId: 'friend-link-categories', logoMediaId: 'media', submissionId: 'friend-link-submissions' }, dates: [...D, 'deletedAt', 'backlinkLastCheckedAt', 'backlinkLastFoundAt'] }
  /* url-redirects excluded: polymorphic entityId (posts|pages) cannot
     be remapped by the generic engine; the table is regenerable */
  /* friend_link_checks excluded: regenerable monitoring data (友链 §85) */
]

const ISO_DATETIME = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/

/* orders/order_items/deliveries/payments/analytics/sessions/jobs are
   intentionally NOT backed up (financial + runtime data, §17). */

function rowsOf(table: MySqlTable): Promise<Record<string, unknown>[]> {
  return getDb().select().from(table) as Promise<Record<string, unknown>[]>
}

export interface BackupManifest {
  format: string
  version: string
  createdAt: string
  database: string
  defaultLocale: string
  locales: string[]
  modules: string[]
  includesMedia: boolean
  counts: Record<string, number>
}

export async function createBackup(options: { includesMedia?: boolean } = {}): Promise<{ fileName: string, zip: Buffer, manifest: BackupManifest }> {
  if (!isBlogDbReady()) {
    throw new Error('Database unavailable')
  }
  const includesMedia = options.includesMedia !== false
  const locales = await listLocales()
  const counts: Record<string, number> = {}
  const zip = new AdmZip()

  for (const spec of TABLE_SPECS) {
    const rows = await rowsOf(spec.table)
    counts[spec.key] = rows.length
    let data = rows
    if (spec.key === 'settings') {
      /* redact secret values (§18) */
      data = rows.map(row => ({
        ...row,
        value: String(row.type) === 'secret' ? '__REDACTED__' : row.value
      }))
    }
    zip.addFile(`data/${spec.key}.json`, Buffer.from(JSON.stringify(data), 'utf-8'))
  }

  const mediaFiles: Array<{ key: string, data: Buffer }> = []
  if (includesMedia) {
    const storage = useStorage('media')
    for (const key of await storage.getKeys()) {
      const data = await storage.getItemRaw(key)
      if (data) mediaFiles.push({ key, data })
    }
    zip.addFile('media/.manifest', Buffer.from(JSON.stringify({ files: mediaFiles.length }), 'utf-8'))
    for (const file of mediaFiles) {
      zip.addFile(`media/${file.key}`, file.data)
    }
  }

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    database: 'mysql',
    defaultLocale: locales.find(l => l.isDefault)?.code ?? 'zh-CN',
    locales: locales.map(l => l.code),
    modules: TABLE_SPECS.map(s => s.key),
    includesMedia,
    counts
  }
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8'))

  return {
    fileName: `backup-${new Date().toISOString().slice(0, 10)}-${Date.now()}.zip`,
    zip: zip.toBuffer(),
    manifest
  }
}

/* ---------------- restore ---------------- */

export interface RestorePreview {
  manifest: BackupManifest
  valid: boolean
  problems: string[]
}

export function readBackupZip(zip: AdmZip): { manifest: BackupManifest, data: Map<string, Record<string, unknown>[]>, mediaFiles: Array<{ key: string, data: Buffer }> } {
  const manifestFile = zip.getEntry('manifest.json')
  if (!manifestFile) throw new Error('manifest.json missing from backup')
  const manifest = JSON.parse(manifestFile.getData().toString('utf-8')) as BackupManifest
  if (manifest.format !== BACKUP_FORMAT) {
    throw new Error(`Unsupported backup format "${manifest.format}"`)
  }
  if (!manifest.version.startsWith('1.')) {
    throw new Error(`Unsupported backup version "${manifest.version}"`)
  }

  const data = new Map<string, Record<string, unknown>[]>()
  for (const spec of TABLE_SPECS) {
    const entry = zip.getEntry(`data/${spec.key}.json`)
    if (!entry) continue
    data.set(spec.key, JSON.parse(entry.getData().toString('utf-8')) as Record<string, unknown>[])
  }

  const mediaFiles: Array<{ key: string, data: Buffer }> = []
  if (manifest.includesMedia) {
    for (const entry of zip.getEntries()) {
      if (entry.entryName.startsWith('media/') && !entry.isDirectory && !entry.entryName.endsWith('.manifest')) {
        mediaFiles.push({ key: entry.entryName.slice('media/'.length), data: entry.getData() })
      }
    }
  }
  return { manifest, data, mediaFiles }
}

export async function previewBackup(zipBuffer: Buffer): Promise<RestorePreview> {
  const { manifest } = readBackupZip(new AdmZip(zipBuffer))
  const problems: string[] = []
  if (manifest.version !== BACKUP_VERSION) {
    problems.push(`Backup version ${manifest.version} differs from current ${BACKUP_VERSION}`)
  }
  return { manifest, valid: problems.length === 0, problems }
}

export interface RestoreContext {
  mapId: (tableKey: string, oldId: number) => number | null
}

/** Replace restore (§13): clear backed-up tables (children first), then
    re-insert inside one transaction with ID remapping. Media files are
    written only after a successful commit. */
export async function restoreBackup(zipBuffer: Buffer, options: { confirm?: string } = {}): Promise<{ restored: Record<string, number> }> {
  if ((options.confirm ?? '') !== 'RESTORE') {
    throw new Error('Restore requires the confirmation word RESTORE')
  }
  const { manifest, data, mediaFiles } = readBackupZip(new AdmZip(zipBuffer))

  const idMaps = new Map<string, Map<number, number>>()
  const restored: Record<string, number> = {}
  const mediaWrites: Array<{ key: string, data: Buffer }> = []
  const db = getDb()

  await db.transaction(async (tx) => {
    /* clear existing rows, children first */
    for (const spec of [...TABLE_SPECS].reverse()) {
      await tx.delete(spec.table)
    }

    for (const spec of TABLE_SPECS) {
      const rows = data.get(spec.key) ?? []
      const map = new Map<number, number>()
      idMaps.set(spec.key, map)
      for (const raw of rows) {
        const row: Record<string, unknown> = { ...raw }
        /* FK remapping; a row whose parent is missing from the backup
           (e.g. a deleted locale) is skipped instead of violating FKs */
        let orphan = false
        for (const [column, target] of Object.entries(spec.remap ?? {})) {
          const oldId = row[column]
          if (typeof oldId === 'number' && oldId > 0) {
            const mapped = idMaps.get(target)?.get(oldId) ?? null
            if (mapped === null) {
              orphan = true
              break
            }
            row[column] = mapped
          }
        }
        if (orphan) continue
        /* self references (parentId) resolved incrementally */
        for (const column of spec.selfRef ?? []) {
          const oldId = row[column]
          if (typeof oldId === 'number' && oldId > 0) {
            row[column] = map.get(oldId) ?? null
          }
        }
        /* dates: any ISO datetime string back to a Date object (JSON
           round-trip turns every drizzle date column into a string) */
        for (const [column, value] of Object.entries(row)) {
          if (typeof value === 'string' && ISO_DATETIME.test(value)) {
            row[column] = new Date(value)
          }
        }
        const oldId = typeof row.id === 'number' ? row.id : null
        const insertRow: Record<string, unknown> = { ...row }
        if (!spec.noId) delete insertRow.id
        try {
          const [result] = await tx.insert(spec.table).values(insertRow)
          const newId = result?.insertId
          if (oldId !== null && newId) map.set(oldId, Number(newId))
          restored[spec.key] = (restored[spec.key] ?? 0) + 1
        } catch (e) {
          /* composite-key duplicates and orphaned FK rows are skipped */
          if (spec.noId) continue
          throw e
        }
      }
    }

    /* media binaries are staged and written after commit (§16) */
    for (const file of mediaFiles) {
      mediaWrites.push(file)
    }
  })

  const storage = useStorage('media')
  for (const file of mediaWrites) {
    await storage.setItemRaw(file.key, file.data)
  }

  /* settings cache must be refreshed after restore */
  const { invalidateSettingsCache } = await import('../settings/settings.service')
  invalidateSettingsCache()

  void manifest
  return { restored }
}

/* ---------------- job history ---------------- */

export async function recordBackupJob(job: {
  fileKey: string
  fileSize: number
  manifestVersion: string
  includesMedia: boolean
  createdBy: number | null
}): Promise<number> {
  const [row] = await getDb().insert(schema.backupJobs).values({
    status: 'completed',
    fileKey: job.fileKey,
    fileSize: job.fileSize,
    manifestVersion: job.manifestVersion,
    includesMedia: job.includesMedia,
    createdBy: job.createdBy,
    startedAt: new Date(),
    completedAt: new Date()
  })
  return row!.insertId
}

export async function listBackupJobs(): Promise<Record<string, unknown>[]> {
  return getDb().select().from(schema.backupJobs).orderBy(desc(schema.backupJobs.id)).limit(50)
}
