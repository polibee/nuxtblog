import {
  bigint,
  timestamp,
  foreignKey,
  index,
  integer,
  pgTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'
import { locales } from './locales'

/* Media (P03): file bytes live in useStorage('media'); this table is
   the metadata index. File identity (filename/size/mime) is not
   translated; alt/caption go to media_translations (architecture
   §9.2 - the file itself is never duplicated per language). */

export const mediaFolders = pgTable('media_folders', {
  id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
  name: varchar('name', { length: 80 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
})

export const media = pgTable(
  'media',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    /* optional folder (media library category); no FK — folder deletion
       leaves media uncategorised instead of blocking */
    folderId: bigint('folder_id', { mode: 'number' }),
    storageKey: varchar('storage_key', { length: 120 }).notNull(),
    filename: varchar('filename', { length: 255 }).notNull(),
    mime: varchar('mime', { length: 120 }).notNull().default('application/octet-stream'),
    size: bigint('size', { mode: 'number' }).notNull().default(0),
    width: integer('width'),
    height: integer('height'),
    /* media asset centre (P20): usage classification + dedup hash */
    usageType: varchar('usage_type', { length: 40 }).notNull().default('general'),
    hash: varchar('hash', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('media_storage_key_key').on(table.storageKey),
    index('media_filename_idx').on(table.filename),
    index('media_usage_idx').on(table.usageType)
  ]
)

/* derived renditions (thumbnail/medium/large); the original is never modified */
export const mediaVariants = pgTable(
  'media_variants',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    mediaId: bigint('media_id', { mode: 'number' }).notNull(),
    variant: varchar('variant', { length: 40 }).notNull(),
    storageKey: varchar('storage_key', { length: 120 }).notNull(),
    width: integer('width'),
    height: integer('height'),
    size: bigint('size', { mode: 'number' }).notNull().default(0),
    format: varchar('format', { length: 10 }).notNull().default('webp'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  table => [
    uniqueIndex('media_variants_media_variant_key').on(table.mediaId, table.variant),
    index('media_variants_media_idx').on(table.mediaId),
    foreignKey({
      name: 'media_variants_media_id_fk',
      columns: [table.mediaId],
      foreignColumns: [media.id]
    }).onDelete('cascade')
  ]
)

export const mediaTranslations = pgTable(
  'media_translations',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    mediaId: bigint('media_id', { mode: 'number' }).notNull(),
    localeId: bigint('locale_id', { mode: 'number' }).notNull(),
    alt: varchar('alt', { length: 255 }).notNull().default(''),
    caption: varchar('caption', { length: 500 }).notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('media_translations_media_locale_key').on(table.mediaId, table.localeId),
    index('media_translations_locale_idx').on(table.localeId),
    foreignKey({
      name: 'media_translations_media_id_fk',
      columns: [table.mediaId],
      foreignColumns: [media.id]
    }).onDelete('cascade'),
    foreignKey({
      name: 'media_translations_locale_id_fk',
      columns: [table.localeId],
      foreignColumns: [locales.id]
    }).onDelete('cascade')
  ]
)
