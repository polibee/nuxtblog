import { z } from 'zod'

const linkUrl = z.string().trim().max(500)
  .refine(v => v === '' || v.startsWith('/') || /^https?:\/\//i.test(v), {
    message: 'linkUrl must be a site-relative path or http(s) URL'
  })
  .nullish()

export const sliderInputSchema = z.object({
  key: z.string().trim().min(1).max(100).regex(/^[a-z0-9][a-z0-9.-]*$/, {
    message: 'key must be lowercase letters, digits, dots or dashes'
  }),
  name: z.string().trim().min(1).max(120),
  enabled: z.boolean().optional(),
  autoplay: z.boolean().optional(),
  intervalMs: z.number().int().min(1000).max(60000).optional(),
  transition: z.enum(['slide', 'fade']).optional(),
  showArrows: z.boolean().optional(),
  showIndicators: z.boolean().optional(),
  pauseOnHover: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional()
}).strict()

export type SliderInput = z.infer<typeof sliderInputSchema>

export const sliderItemInputSchema = z.object({
  imageMediaId: z.number().int().positive(),
  mobileImageMediaId: z.number().int().positive().nullish(),
  linkUrl,
  linkTarget: z.enum(['self', 'blank']).optional(),
  enabled: z.boolean().optional(),
  startsAt: z.string().datetime().nullish(),
  endsAt: z.string().datetime().nullish(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  translations: z.record(
    z.string(),
    z.object({
      title: z.string().trim().max(200).nullish(),
      description: z.string().trim().max(500).nullish(),
      buttonText: z.string().trim().max(50).nullish(),
      linkUrl,
      altText: z.string().trim().max(300).nullish()
    })
  ).optional()
}).strict()

export type SliderItemInput = z.infer<typeof sliderItemInputSchema>

export interface PublicSliderItem {
  id: number
  image: string
  mobileImage?: string | null
  alt: string
  title?: string | null
  description?: string | null
  buttonText?: string | null
  url?: string | null
  target: 'self' | 'blank'
}

export interface PublicSlider {
  key: string
  config: {
    autoplay: boolean
    interval: number
    transition: 'slide' | 'fade'
    showArrows: boolean
    showIndicators: boolean
    pauseOnHover: boolean
  } | null
  items: PublicSliderItem[]
}
