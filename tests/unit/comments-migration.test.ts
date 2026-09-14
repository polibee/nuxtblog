import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PostgreSQL comments migration', () => {
  it('keeps comment metadata migration in the Supabase migration chain', () => {
    const migration = resolve(process.cwd(), 'supabase/migrations/20260913000100_comments_metadata.sql')
    expect(existsSync(migration)).toBe(true)
    const sql = readFileSync(migration, 'utf8')

    for (const column of [
      'author_url', 'gravatar_hash', 'browser_name', 'browser_version',
      'os_name', 'os_version', 'device_type', 'ip_hash', 'moderation_reason',
      'approved_at', 'approved_by'
    ]) {
      expect(sql).toContain(`add column if not exists ${column}`)
    }
    expect(sql).toContain('comments_post_status_idx')
    expect(sql).toContain('comments_parent_idx')
    expect(sql).toContain('comments_user_idx')
    expect(sql).toContain('comments_approved_by_fk')
  })
})
