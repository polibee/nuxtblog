import SliderResource from './admin/SliderResource'

export default defineModule(t => ({
  name: 'slider',
  resources: [SliderResource(t)],
  navGroups: [{ label: t('group.content'), sort: 16 }]
}))
