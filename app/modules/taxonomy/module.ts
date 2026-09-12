import makeTaxonomyResource from './admin/TaxonomyResource'

export default defineModule(t => ({
  name: 'taxonomy',
  resources: [makeTaxonomyResource('category')(t), makeTaxonomyResource('tag')(t)],
  navGroups: [{ label: t('res.taxonomy.group'), sort: 45 }]
}))
