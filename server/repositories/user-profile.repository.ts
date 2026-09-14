import { eq } from 'drizzle-orm'
import { getDb } from './db.server'
import { media } from './schema/media'
import { userPreferences, userProfiles } from './schema/user-profiles'
import { users } from './schema/users'

export interface UserProfileView {
  userId: number
  name: string
  email: string
  websiteUrl: string | null
  bio: string
  avatarUrl: string | null
  locale: string
  timezone: string
}

export interface UserProfileRepository {
  findByUserId(userId: number): Promise<UserProfileView | null>
  upsert(userId: number, input: ProfilePatch): Promise<UserProfileView>
}

export interface ProfilePatch {
  websiteUrl?: string | null
  bio?: string
  locale?: string
  timezone?: string
  avatarMediaId?: number | null
}

async function findRow(userId: number): Promise<UserProfileView | null> {
  const rows = await getDb()
    .select({ user: users, profile: userProfiles, preferences: userPreferences, storageKey: media.storageKey })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .leftJoin(userPreferences, eq(userPreferences.userId, users.id))
    .leftJoin(media, eq(media.id, userProfiles.avatarMediaId))
    .where(eq(users.id, userId))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    userId: row.user.id,
    name: row.user.name,
    email: row.user.email,
    websiteUrl: row.profile?.websiteUrl ?? null,
    bio: row.profile?.bio ?? '',
    avatarUrl: row.storageKey ? `/media/${row.storageKey}` : null,
    locale: row.preferences?.locale ?? 'zh-CN',
    timezone: row.preferences?.timezone ?? 'Asia/Shanghai'
  }
}

export async function findByUserId(userId: number): Promise<UserProfileView | null> {
  return findRow(userId)
}

export async function upsertProfile(userId: number, input: ProfilePatch): Promise<UserProfileView> {
  const db = getDb()
  const profileInput = {
    userId,
    ...(input.websiteUrl === undefined ? {} : { websiteUrl: input.websiteUrl }),
    ...(input.bio === undefined ? {} : { bio: input.bio }),
    ...(input.avatarMediaId === undefined ? {} : { avatarMediaId: input.avatarMediaId })
  }
  await db.insert(userProfiles).values(profileInput).onDuplicateKeyUpdate({ set: profileInput })
  const preferences = {
    userId,
    ...(input.locale === undefined ? {} : { locale: input.locale }),
    ...(input.timezone === undefined ? {} : { timezone: input.timezone })
  }
  await db.insert(userPreferences).values(preferences).onDuplicateKeyUpdate({ set: preferences })
  const result = await findRow(userId)
  if (!result) throw new Error(`User #${userId} not found`)
  return result
}
