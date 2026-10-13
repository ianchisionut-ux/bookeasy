export const APPOINTMENT_CATEGORIES = [
  'SALON', 'COAFURA_FRIZERIE', 'BARBER_SHOP', 'NAILS', 'COSMETICA', 'LASHES',
  'MAKE_UP', 'EPILARE', 'MASAJ', 'SPA_WELLNESS', 'FITNESS', 'NUTRITIE_WELLNESS',
  'ESTETICA_REMODELARE', 'TATUAJE_PIERCING', 'MEDICAL_ESTETIC', 'SPORT_BAZE',
  'MEDICAL', 'CURSURI', 'LOC_JOACA', 'ACCES_CLUB', 'STUDIO_BEAUTY', 'CLINICA',
] as const
export const PUBLIC_CATEGORIES = [...APPOINTMENT_CATEGORIES, 'EVENT_VENUE'] as const
export const BUSINESS_CATEGORIES = [...PUBLIC_CATEGORIES, 'HOTEL', 'PENSIUNE'] as const

export type BusinessCategory = typeof BUSINESS_CATEGORIES[number]
export type PublicCategory = typeof PUBLIC_CATEGORIES[number]

export const CATEGORY_LABEL: Record<BusinessCategory, string> = {
  SALON: 'Salon',
  COAFURA_FRIZERIE: 'Coafură & frizerie',
  BARBER_SHOP: 'Barber Shop',
  COSMETICA: 'Cosmetică & ten',
  NAILS: 'Unghii',
  LASHES: 'Gene & sprâncene',
  MAKE_UP: 'Make-up',
  EPILARE: 'Epilare',
  MASAJ: 'Masaj & terapii',
  SPA_WELLNESS: 'Spa & wellness',
  FITNESS: 'Fitness & personal training',
  NUTRITIE_WELLNESS: 'Nutriție & wellness',
  ESTETICA_REMODELARE: 'Estetică & remodelare',
  TATUAJE_PIERCING: 'Tatuaje & piercing',
  MEDICAL_ESTETIC: 'Servicii medical-estetice',
  SPORT_BAZE: 'Sport / Baze sportive',
  MEDICAL: 'Medical',
  CURSURI: 'Cursuri',
  LOC_JOACA: 'Loc de joacă',
  ACCES_CLUB: 'Acces club',
  STUDIO_BEAUTY: 'Studio de beauty',
  CLINICA: 'Clinică',
  EVENT_VENUE: 'Spații evenimente',
  HOTEL: 'Hotel',
  PENSIUNE: 'Pensiune',
}

export function isAppointmentCategory(category: string | null | undefined): boolean {
  return APPOINTMENT_CATEGORIES.some((item) => item === category)
}
