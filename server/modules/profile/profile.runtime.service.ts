import * as mysql from './profile.service'
import * as postgres from './profile.postgres.service'
import { createDomainRepositoryContext } from '../../repositories/domain-context'

const implementation = (createDomainRepositoryContext({ driver: process.env.DB_DRIVER }).isPostgres ? postgres : mysql) as typeof mysql

export type { ProfileBundle, PublicProfile, PublicProfileSection } from './profile.service'
export const SECTION_TYPES = mysql.SECTION_TYPES
export const getProfileBundle = implementation.getProfileBundle
export const saveProfileBundle = implementation.saveProfileBundle
export const getPublicProfile = implementation.getPublicProfile
