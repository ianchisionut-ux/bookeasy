export const RESERVED_PUBLIC_SLUGS = new Set(['confirmare','contracte','demo','harta-test','plata-anulata','plata-confirmata','stergere-cont','api','aplicatii','cont','cont-suspendat','dashboard','descopera','dpa','fitness','forgot-password','harta','legal','login','offline','onboarding','pentru-afaceri','politica-de-confidentialitate','reset-password','signup','superadmin','termeni-si-conditii','verify-email','admin','contact','www','support','robots.txt','sitemap.xml'])

export function publicSlugFromName(name: string) {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '') || 'afacere'
  return RESERVED_PUBLIC_SLUGS.has(slug) || slug.length < 3 ? `${slug}-programari` : slug
}

export function validPublicSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 64 && !RESERVED_PUBLIC_SLUGS.has(slug)
}
