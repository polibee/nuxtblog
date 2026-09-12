import type { BadgeStyle, Translator } from '~/admin/core/types'

export default (t: Translator) => {
  const yesNo = (label: string): Record<string | number, BadgeStyle> => ({
    true: { label, variant: 'success' },
    false: { label: '—', variant: 'secondary' }
  })

  return defineResource({
    name: 'locales',
    model: 'Locale',
    label: t('res.locale.label'),
    labelPlural: t('res.locale.plural'),
    icon: 'globe',
    group: t('group.system'),
    sort: 96,
    permissionPrefix: 'locales',

    table: () => [
      textColumn('code', t('res.locale.col.code'), { sortable: true }),
      textColumn('nativeName', t('res.locale.col.nativeName')),
      textColumn('urlPrefix', t('res.locale.col.urlPrefix')),
      badgeColumn('isDefault', t('res.locale.col.isDefault'), yesNo(t('res.locale.value.default'))),
      badgeColumn('enabled', t('res.locale.col.enabled'), yesNo(t('status.active'))),
      badgeColumn('contentEnabled', t('res.locale.col.contentEnabled'), yesNo(t('status.active'))),
      badgeColumn('uiEnabled', t('res.locale.col.uiEnabled'), yesNo(t('status.active'))),
      numberColumn('sortOrder', t('res.locale.col.sort'), { sortable: true })
    ],

    form: () => [
      section(t('res.locale.section.identity'), [
        grid(2, [
          textInput('code', t('res.locale.field.code'), { required: true, placeholder: 'zh-CN', helpText: t('res.locale.help.code') }),
          textInput('nativeName', t('res.locale.field.nativeName'), { required: true, placeholder: '简体中文' })
        ]),
        grid(2, [
          textInput('name', t('res.locale.field.name'), { required: true, placeholder: 'Simplified Chinese' }),
          textInput('urlPrefix', t('res.locale.field.urlPrefix'), { placeholder: 'en', helpText: t('res.locale.help.urlPrefix') })
        ])
      ]),
      section(t('res.locale.section.behavior'), [
        grid(2, [
          switchInput('enabled', t('res.locale.field.enabled'), { defaultValue: true }),
          switchInput('contentEnabled', t('res.locale.field.contentEnabled'))
        ]),
        grid(2, [
          switchInput('uiEnabled', t('res.locale.field.uiEnabled')),
          switchInput('isDefault', t('res.locale.field.isDefault'))
        ]),
        numberInput('sortOrder', t('res.locale.field.sort'), { defaultValue: 0, min: 0, max: 9999 })
      ])
    ],

    infolist: () => [
      textEntry('code', t('res.locale.col.code')),
      textEntry('name', t('res.locale.field.name')),
      textEntry('nativeName', t('res.locale.col.nativeName')),
      textEntry('urlPrefix', t('res.locale.col.urlPrefix')),
      booleanEntry('enabled', t('res.locale.col.enabled')),
      booleanEntry('contentEnabled', t('res.locale.col.contentEnabled')),
      booleanEntry('uiEnabled', t('res.locale.col.uiEnabled')),
      booleanEntry('isDefault', t('res.locale.col.isDefault')),
      textEntry('sortOrder', t('res.locale.col.sort'))
    ]
  })
}
