export const APPOINTMENT_CATEGORIES = [
  'SALON', 'COAFURA_FRIZERIE', 'BARBER_SHOP', 'NAILS', 'COSMETICA', 'LASHES',
  'MAKE_UP', 'EPILARE', 'MASAJ', 'SPA_WELLNESS', 'FITNESS', 'NUTRITIE_WELLNESS',
  'ESTETICA_REMODELARE', 'TATUAJE_PIERCING', 'MEDICAL_ESTETIC', 'SPORT_BAZE',
  'MEDICAL', 'CURSURI', 'LOC_JOACA', 'ACCES_CLUB', 'STUDIO_BEAUTY', 'CLINICA',
  'PSIHOLOGIE', 'KINETOTERAPIE', 'LOGOPEDIE', 'VETERINAR',
  'AVOCATURA', 'MEDITATII', 'LIMBI_STRAINE', 'SERVICE_AUTO', 'DETAILING_AUTO',
] as const
export const PUBLIC_CATEGORIES = [...APPOINTMENT_CATEGORIES, 'EVENT_VENUE'] as const
export const BUSINESS_CATEGORIES = [...PUBLIC_CATEGORIES] as const

// Read historical records without offering the unfinished accommodation modules.
export type BusinessCategory = typeof BUSINESS_CATEGORIES[number] | 'HOTEL' | 'PENSIUNE' | 'GROOMING' | 'MUZICA'
export type PublicCategory = typeof PUBLIC_CATEGORIES[number]

export const PUBLIC_CATEGORY_GROUPS = [
  { id: 'beauty', label: 'Beauty & wellness', categories: ['SALON', 'COAFURA_FRIZERIE', 'BARBER_SHOP', 'NAILS', 'COSMETICA', 'LASHES', 'MAKE_UP', 'EPILARE', 'ESTETICA_REMODELARE', 'TATUAJE_PIERCING', 'STUDIO_BEAUTY', 'MASAJ', 'SPA_WELLNESS', 'NUTRITIE_WELLNESS'] },
  { id: 'health', label: 'Sănătate & recuperare', categories: ['MEDICAL', 'CLINICA', 'MEDICAL_ESTETIC', 'PSIHOLOGIE', 'KINETOTERAPIE', 'LOGOPEDIE'] },
  { id: 'sport', label: 'Sport & timp liber', categories: ['FITNESS', 'SPORT_BAZE', 'ACCES_CLUB', 'LOC_JOACA', 'EVENT_VENUE'] },
  { id: 'education', label: 'Educație & lecții', categories: ['CURSURI', 'MEDITATII', 'LIMBI_STRAINE'] },
  { id: 'services', label: 'Servicii specializate', categories: ['VETERINAR', 'AVOCATURA', 'SERVICE_AUTO', 'DETAILING_AUTO'] },
] as const satisfies ReadonlyArray<{ id: string; label: string; categories: readonly PublicCategory[] }>

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
  PSIHOLOGIE: 'Psihologie & psihoterapie',
  KINETOTERAPIE: 'Kinetoterapie & recuperare',
  LOGOPEDIE: 'Logopedie',
  VETERINAR: 'Cabinete veterinare',
  GROOMING: 'Grooming animale',
  AVOCATURA: 'Avocatură',
  MEDITATII: 'Meditații',
  LIMBI_STRAINE: 'Limbi străine',
  MUZICA: 'Lecții de muzică',
  SERVICE_AUTO: 'Service auto',
  DETAILING_AUTO: 'Detailing auto',
}

export function isAppointmentCategory(category: string | null | undefined): boolean {
  return APPOINTMENT_CATEGORIES.some((item) => item === category)
}

export function bookingTerminology(category: string | null | undefined): { singular: string; plural: string; heading: string } {
  if (category === 'FITNESS') return { singular: 'ședință', plural: 'ședințe', heading: 'Ședințe' }
  if (category === 'CURSURI') return { singular: 'înscriere', plural: 'înscrieri', heading: 'Înscrieri' }
  if (category === 'SPORT_BAZE' || category === 'LOC_JOACA' || category === 'ACCES_CLUB' || category === 'EVENT_VENUE' || category === 'HOTEL' || category === 'PENSIUNE') {
    return { singular: 'rezervare', plural: 'rezervări', heading: 'Rezervări' }
  }
  return { singular: 'programare', plural: 'programări', heading: 'Programări' }
}

export function isPatientCategory(category: string | null | undefined): boolean {
  return category === 'CLINICA' || category === 'MEDICAL' || category === 'MEDICAL_ESTETIC' || category === 'PSIHOLOGIE' || category === 'KINETOTERAPIE' || category === 'LOGOPEDIE'
}

export function isDoctorCategory(category: string | null | undefined): boolean {
  return category === 'CLINICA' || category === 'MEDICAL'
}

export function practitionerLabel(category: string | null | undefined): { singular: string; plural: string; definite: string } {
  if (isDoctorCategory(category)) return { singular: 'medic', plural: 'Medici', definite: 'medicul' }
  if (category === 'PSIHOLOGIE') return { singular: 'psiholog', plural: 'Psihologi', definite: 'psihologul' }
  if (category === 'KINETOTERAPIE') return { singular: 'kinetoterapeut', plural: 'Kinetoterapeuți', definite: 'kinetoterapeutul' }
  if (category === 'LOGOPEDIE') return { singular: 'logoped', plural: 'Logopezi', definite: 'logopedul' }
  if (category === 'VETERINAR') return { singular: 'medic veterinar', plural: 'Medici veterinari', definite: 'medicul veterinar' }
  if (category === 'AVOCATURA') return { singular: 'avocat', plural: 'Avocați', definite: 'avocatul' }
  if (category === 'MEDITATII' || category === 'LIMBI_STRAINE' || category === 'MUZICA') return { singular: 'profesor', plural: 'Profesori', definite: 'profesorul' }
  if (category === 'FITNESS' || category === 'SPORT_BAZE') return { singular: 'antrenor', plural: 'Antrenori', definite: 'antrenorul' }
  if (category === 'CURSURI') return { singular: 'instructor', plural: 'Instructori', definite: 'instructorul' }
  return { singular: 'specialist', plural: 'Specialiști', definite: 'specialistul' }
}

export function allPractitionersLabel(category: string | null | undefined): string {
  if (category === 'PSIHOLOGIE') return 'Toți psihologii'
  if (category === 'KINETOTERAPIE') return 'Toți kinetoterapeuții'
  if (category === 'LOGOPEDIE') return 'Toți logopezii'
  if (category === 'VETERINAR') return 'Toți medicii veterinari'
  if (category === 'AVOCATURA') return 'Toți avocații'
  if (category === 'MEDITATII' || category === 'LIMBI_STRAINE' || category === 'MUZICA') return 'Toți profesorii'
  if (isDoctorCategory(category)) return 'Toți medicii'
  if (category === 'FITNESS' || category === 'SPORT_BAZE') return 'Toți antrenorii'
  if (category === 'CURSURI') return 'Toți instructorii'
  return 'Toți specialiștii'
}

export function offerLabel(category: string | null | undefined): { singular: string; plural: string; heading: string } {
  if (category === 'EVENT_VENUE') return { singular: 'sală', plural: 'săli', heading: 'Săli' }
  if (category === 'HOTEL' || category === 'PENSIUNE') return { singular: 'cameră', plural: 'camere', heading: 'Camere' }
  if (category === 'FITNESS') return { singular: 'ședință', plural: 'ședințe', heading: 'Ședințe' }
  if (category === 'SPORT_BAZE') return { singular: 'activitate', plural: 'activități', heading: 'Activități' }
  if (category === 'CURSURI') return { singular: 'curs', plural: 'cursuri', heading: 'Cursuri' }
  if (category === 'LOC_JOACA') return { singular: 'sesiune', plural: 'sesiuni', heading: 'Sesiuni' }
  if (category === 'ACCES_CLUB') return { singular: 'tip de acces', plural: 'tipuri de acces', heading: 'Tipuri de acces' }
  return { singular: 'serviciu', plural: 'servicii', heading: 'Servicii' }
}
