import sharp, { type Sharp } from 'sharp'

/* Base image variants (media.txt §13/20/21): generated once on upload
   for raster images. GIF is skipped (animation), SVG never reaches the
   media store (P14 whitelist). Originals are never modified (Rule 1) —
   EXIF orientation is baked into the rendition, metadata (incl. GPS)
   is stripped by sharp by default. */

export interface GeneratedVariant {
  variant: string
  storageKey: string
  width: number
  height: number
  size: number
  format: string
}

const VARIANT_SPECS = [
  { variant: 'thumbnail', width: 400, height: 400, fit: 'cover' as const },
  { variant: 'medium', width: 768, height: null, fit: 'inside' as const },
  { variant: 'large', width: 1280, height: null, fit: 'inside' as const }
] as const

export function makeVariantStorageKey(): string {
  return `${Date.now()}-${crypto.randomUUID()}`
}

export async function generateImageVariants(data: Buffer): Promise<GeneratedVariant[]> {
  const results: GeneratedVariant[] = []
  let image: Sharp
  try {
    image = sharp(data, { failOn: 'none' }).rotate()
    const meta = await image.metadata()
    if (!meta.width || meta.format === 'gif') return []
  } catch {
    return []
  }
  for (const spec of VARIANT_SPECS) {
    try {
      const pipeline = spec.height
        ? image.clone().resize({ width: spec.width, height: spec.height, fit: spec.fit })
        : image.clone().resize({ width: spec.width, fit: spec.fit, withoutEnlargement: true })
      const out = await pipeline.webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
      results.push({
        variant: spec.variant,
        storageKey: makeVariantStorageKey(),
        width: out.info.width,
        height: out.info.height,
        size: out.data.length,
        format: 'webp'
      })
      await useStorage('media').setItemRaw(results[results.length - 1]!.storageKey, out.data)
    } catch {
      /* a failed variant is non-fatal: original still works */
    }
  }
  return results
}
