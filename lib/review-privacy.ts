// Numele clienților este stocat în formatul folosit în aplicație: Nume Prenume.
export function publicReviewName(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/u).filter(Boolean)
  if (parts.length === 0) return 'Client'
  if (parts.length === 1) return parts[0]
  // Recenziile noi sunt deja salvate ca „Prenume N.”; nu le anonimizăm a doua oară.
  if (/\s+[A-ZĂÂÎȘȚ]\.$/u.test(parts.join(' '))) return parts.join(' ')
  const surnameInitial = parts[0].charAt(0).toLocaleUpperCase('ro-RO')
  return parts.slice(1).join(' ') + ' ' + surnameInitial + '.'
}
