import { insertRedirect } from '../repositories/alias.runtime.repository'

/* Alias-aware route resolver (alias unification doc 4.2): menu, sitemap,
   RSS, canonical and the language switcher all build content URLs through
   this single helper. */

export type ContentEntityType = 'post' | 'page' | 'category' | 'tag'

export function contentUrl(entityType: ContentEntityType, alias: string): string {
  switch (entityType) {
    case 'post':
      return `/posts/${alias}`
    case 'page':
      return `/pages/${alias}`
    case 'category':
      return `/category/${alias}`
    case 'tag':
      return `/tag/${alias}`
  }
}

/** record a 301 for an alias change (old public path keeps working) */
export async function recordUrlRedirect(input: {
  entityType: ContentEntityType
  entityId: number
  oldPath: string
  newPath: string
  statusCode?: 301 | 308
}): Promise<void> {
  await insertRedirect({
    entityType: input.entityType,
    entityId: input.entityId,
    localeId: null,
    oldPath: input.oldPath,
    newPath: input.newPath,
    statusCode: input.statusCode ?? 301
  })
}
