import * as mysql from './friend-links.service'
import * as postgres from './friend-links.postgres.service'
import { createDomainRepositoryContext } from '../../repositories/domain-context'

const implementation = createDomainRepositoryContext({ driver: process.env.DB_DRIVER }).isPostgres ? postgres : mysql
export const createSubmission = implementation.createSubmission
export const listSubmissions = implementation.listSubmissions
export const getSubmission = implementation.getSubmission
export const approveSubmission = implementation.approveSubmission
export const reviewSubmission = implementation.reviewSubmission
export const createFriendLink = implementation.createFriendLink
export const updateFriendLink = implementation.updateFriendLink
export const deleteFriendLink = implementation.deleteFriendLink
export const checkFriendLinkNow = implementation.checkFriendLinkNow
export const getPublicFriendLinks = implementation.getPublicFriendLinks
