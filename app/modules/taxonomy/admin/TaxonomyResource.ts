import type { Translator } from '~/admin/core/types'
import { localizedInput } from '~/admin/schemas/builders/fields'

/* Factory shared by the categories/tags resources (P04). The kind only
   changes the API segment, permission prefix and labels. */

export default function makeTaxonomyResource(kind: 'category' | 'tag') {
  return (t: Translator) => {
    const label = kind === 'category' ? t('res.taxonomy.categoriesLabel') : t('res.taxonomy.tagsLabel')
    const prefix = kind === 'category' ? 'categories' : 'tags'
    return defineResource({
      name: prefix,
      model: kind === 'category' ? 'Category' : 'Tag',
      label,
      labelPlural: label,
      icon: kind === 'category' ? 'tag' : 'star',
      group: t('res.taxonomy.group'),
      sort: kind === 'category' ? 41 : 42,
      permissionPrefix: prefix,
      searchable: ['name', 'alias'],

      table: () => [
        textColumn('title', t('res.taxonomy.field.name'), { sortable: true }),
        textColumn('alias', t('res.posts.field.alias')),
        dateColumn('createdAt', t('res.posts.col.created'))
      ],

      form: () => [
        section(t('res.taxonomy.section'), [
          textInput('alias', t('res.posts.field.alias'), {
            required: true,
            colSpan: 2,
            helpText: t('res.posts.help.alias')
          }),
          localizedInput('translations', t('res.taxonomy.field.localized'), [
            textInput('name', t('res.taxonomy.field.name'), { required: true }),
            textarea('description', t('res.taxonomy.field.description'), { rows: 2 })
          ])
        ])
      ],

      infolist: () => [
        textEntry('title', t('res.taxonomy.field.name')),
        textEntry('alias', t('res.posts.field.alias'))
      ]
    })
  }
}
