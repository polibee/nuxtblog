import { requirePermission } from '../../../../utils/auth'
import { getProfileBundle } from '../../../../modules/profile/profile.runtime.service'
import { safePublicHttpUrl } from '#shared/schemas/author-card'
import { escapeHtml } from '../../../../utils/xml'

function text(value: unknown): string {
  return escapeHtml(String(value ?? '').trim())
}

function list(items: unknown[], render: (item: Record<string, unknown>) => string): string {
  return items
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map(render)
    .join('')
}

/** Admin-only print view. The browser print dialog can save this document as PDF. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'profile.export')
  const bundle = await getProfileBundle()
  const profile = bundle.profile
  const socials = list(bundle.socials, (item) => {
    const url = safePublicHttpUrl(String(item.url ?? ''))
    return url ? `<a href="${escapeHtml(url)}">${text(item.handle || item.platform)}</a>` : ''
  })
  const experiences = list(bundle.experiences, item => `<article><h3>${text(item.role)} · ${text(item.organization)}</h3><p class="muted">${text(item.period)}${item.location ? ` · ${text(item.location)}` : ''}</p><p>${text(item.description)}</p></article>`)
  const projects = list(bundle.projects, item => `<article><h3>${text(item.name)}</h3><p>${text(item.description)}</p><p class="muted">${text(item.tags)}</p></article>`)
  const skills = list(bundle.skills, item => `<span class="pill">${text(item.name)}</span>`)
  const education = list(bundle.education, item => `<article><h3>${text(item.school)} · ${text(item.program)}</h3><p class="muted">${text(item.period)}</p><p>${text(item.details)}</p></article>`)
  const certifications = list(bundle.certifications, item => `<article><h3>${text(item.name)}</h3><p class="muted">${text(item.issuer)} · ${text(item.dateIssued)}</p></article>`)
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${text(profile.displayName)} - Resume</title><style>
    @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,"Microsoft YaHei",sans-serif;color:#18212f;line-height:1.55;max-width:820px;margin:auto}h1{font-size:30px;margin:0 0 4px}h2{font-size:16px;border-bottom:1px solid #d9e0e8;padding-bottom:6px;margin:24px 0 10px}h3{font-size:14px;margin:0 0 3px}p{margin:4px 0;font-size:12px}.muted{color:#64748b;font-size:11px}a{color:#2563eb;text-decoration:none}.pills{display:flex;gap:6px;flex-wrap:wrap}.pill{background:#eef2ff;border-radius:999px;padding:3px 8px;font-size:11px}@media print{body{max-width:none}}
  </style></head><body><header><h1>${text(profile.displayName)}</h1><p>${text(profile.headline)}</p><p class="muted">${text(profile.location)}</p><p>${socials}</p></header>
  ${profile.bio ? `<section><h2>Profile</h2><p>${text(profile.bio)}</p></section>` : ''}
  ${experiences ? `<section><h2>Experience</h2>${experiences}</section>` : ''}
  ${projects ? `<section><h2>Projects</h2>${projects}</section>` : ''}
  ${skills ? `<section><h2>Skills</h2><div class="pills">${skills}</div></section>` : ''}
  ${education ? `<section><h2>Education</h2>${education}</section>` : ''}
  ${certifications ? `<section><h2>Certifications</h2>${certifications}</section>` : ''}
  <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350))</script></body></html>`
  setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', 'inline; filename="resume.html"')
  return html
})
