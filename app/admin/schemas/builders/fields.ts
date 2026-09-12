import type { FieldNode, FieldOption, FieldType, RelationConfig } from '../../core/types'

interface FieldOptions {
  placeholder?: string
  required?: boolean
  disabled?: boolean
  helpText?: string
  defaultValue?: unknown
  options?: FieldOption[]
  min?: number
  max?: number
  step?: number
  rows?: number
  colSpan?: 1 | 2 | 3 | 4
  relation?: RelationConfig
  subFields?: FieldNode[]
  localizedFields?: FieldNode[]
}

function make(kind: FieldType, name: string, label: string, opts: FieldOptions = {}): FieldNode {
  return { type: 'field', kind, name, label, ...opts }
}

export function textInput(name: string, label: string, opts?: FieldOptions): FieldNode {
  return make('text', name, label, opts)
}

export function emailInput(name: string, label: string, opts?: FieldOptions): FieldNode {
  return make('email', name, label, opts)
}

export function passwordInput(name: string, label: string, opts?: FieldOptions): FieldNode {
  return make('password', name, label, opts)
}

export function numberInput(name: string, label: string, opts?: FieldOptions): FieldNode {
  return make('number', name, label, opts)
}

export function textarea(name: string, label: string, opts?: FieldOptions): FieldNode {
  return make('textarea', name, label, opts)
}

export function selectInput(
  name: string,
  label: string,
  options: FieldOption[],
  opts?: Omit<FieldOptions, 'options'>
): FieldNode {
  return make('select', name, label, { ...opts, options })
}

export function switchInput(name: string, label: string, opts?: FieldOptions): FieldNode {
  return make('switch', name, label, opts)
}

export function checkboxInput(name: string, label: string, opts?: FieldOptions): FieldNode {
  return make('checkbox', name, label, opts)
}

export function dateInput(name: string, label: string, opts?: FieldOptions): FieldNode {
  return make('date', name, label, opts)
}

/** relation picker: loads options from another resource's API */
export function relationInput(
  name: string,
  label: string,
  relation: { resource: string, labelKey: string },
  opts?: FieldOptions
): FieldNode {
  return make('relation', name, label, { ...opts, relation })
}

/** file upload (multipart); value is a File at submit time */
export function fileInput(name: string, label: string, opts?: FieldOptions): FieldNode {
  return make('file', name, label, opts)
}

/** array-of-objects editor; each row renders the given sub-fields */
export function repeaterInput(
  name: string,
  label: string,
  subFields: FieldNode[],
  opts?: FieldOptions
): FieldNode {
  return make('repeater', name, label, { ...opts, subFields })
}

/** media library modal picker: value = media id (nullable) */
export function mediaPicker(name: string, label: string, opts?: FieldOptions): FieldNode {
  return make('mediaPicker', name, label, opts)
}

/** permission matrix (string[] of granted permission keys) */
export function permissionsInput(name: string, label: string, opts?: FieldOptions): FieldNode {
  return make('permissions', name, label, opts)
}

/** tiptap rich text editor (stores HTML) */
export function richTextInput(name: string, label: string, opts?: FieldOptions): FieldNode {
  return make('richtext', name, label, opts)
}

/** localized editor: value is translations[locale][field]; sub-fields render per locale tab */
export function localizedInput(
  name: string,
  label: string,
  subFields: FieldNode[],
  opts?: Omit<FieldOptions, 'subFields' | 'relation'>
): FieldNode {
  return make('localized', name, label, { ...opts, localizedFields: subFields })
}

/** multi-select of related resource ids; value is an array of ids */
export function multiRelationInput(
  name: string,
  label: string,
  relation: { resource: string, labelKey: string, creatable?: boolean },
  opts?: Omit<FieldOptions, 'subFields' | 'relation'>
): FieldNode {
  return make('multirelation', name, label, { ...opts, relation })
}
