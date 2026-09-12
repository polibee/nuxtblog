import MembershipPlansResource from './admin/MembershipPlansResource'

export default defineModule(t => ({
  name: 'membership',
  resources: [MembershipPlansResource(t)],
  navGroups: [{ label: t('res.store.group'), sort: 30 }]
}))
