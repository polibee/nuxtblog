import { z, type ZodTypeAny } from 'zod'
import type { FieldNode, SchemaNode } from '../core/types'

/* =============================================================
 * Schema -> Zod compiler. Field definitions stay declarative;
 * validation rules are derived automatically from the schema.
 * ============================================================= */

/** kinds whose base rule is a plain z.string(), safe for .min() */
const STRING_BASE_KINDS: FieldNode['kind'][] = ['text', 'password', 'textarea', 'date', 'richtext']

function baseRuleFor(node: FieldNode): ZodTypeAny {
  switch (node.kind) {
    case 'email':
      return z.string().email(`${node.label} must be a valid email`)
    case 'number':
      return node.required
        ? z.coerce.number({ message: `${node.label} is required` })
        : z.preprocess(
            v => (v === '' || v === null || v === undefined ? undefined : Number(v)),
            z.number().optional()
          )
    case 'switch':
    case 'checkbox':
      return z.boolean().default(false)
    case 'file':
      return z.any()
    case 'repeater':
      return z.array(z.record(z.unknown()))
    case 'localized':
      return z.record(z.string(), z.record(z.unknown()))
    case 'multirelation':
      return z.array(z.union([z.string(), z.number()]))
    case 'permissions':
      return z.array(z.string())
    case 'select':
      return z.union([z.string(), z.number(), z.null()]).transform(v => v ?? '')
    case 'relation':
      return z.union([z.string(), z.number(), z.null()]).transform(v => (v === null ? '' : v))
    default:
      return z.string()
  }
}

function compileField(node: FieldNode): ZodTypeAny {
  const extras = node.rules ?? []
  let rule = baseRuleFor(node)

  if (node.required && node.kind === 'email') {
    rule = z.string().min(1, `${node.label} is required`).email(`${node.label} must be a valid email`)
  } else if (node.required && STRING_BASE_KINDS.includes(node.kind)) {
    rule = (rule as z.ZodString).min(1, `${node.label} is required`)
  } else if (node.required && node.kind === 'file') {
    rule = z.any().refine(v => v instanceof File && v.size > 0, `${node.label} is required`)
  } else if (node.required && node.kind === 'number') {
    rule = z.preprocess(
      v => (v === '' || v === null || v === undefined ? undefined : Number(v)),
      z.number({ message: `${node.label} is required` })
    )
  } else if (node.required && (node.kind === 'select' || node.kind === 'relation')) {
    rule = z.union([z.string(), z.number()])
      .refine(v => v !== '' && v !== null && v !== undefined, `${node.label} is required`)
  }

  for (const extra of extras) {
    rule = rule.pipe(extra)
  }
  return rule
}

export function schemaToZod(schema: SchemaNode[]): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {}
  for (const node of schema) {
    if (node.type === 'field') {
      shape[node.name] = compileField(node)
    } else {
      for (const child of node.children) {
        if (child.type === 'field') shape[child.name] = compileField(child)
      }
    }
  }
  return z.object(shape)
}
