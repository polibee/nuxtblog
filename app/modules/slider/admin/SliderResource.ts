import type { Translator } from '~/admin/core/types'
import SliderManagerPage from './SliderManagerPage.vue'

export default (t: Translator) => defineResource({
  name: 'sliders',
  model: 'Slider',
  label: t('res.slider.label'),
  labelPlural: t('res.slider.label'),
  icon: 'image',
  group: t('group.content'),
  sort: 16,
  permissionPrefix: 'sliders',
  pages: {
    list: SliderManagerPage
  },
  table: () => []
})
