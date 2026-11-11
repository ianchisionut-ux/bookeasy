export function canonicalCustomerPhone(value: string): string {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (/^0\d{9}$/.test(digits)) digits = `40${digits.slice(1)}`
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : value.trim()
}

export function duplicateCustomerGroups<T extends { businessId: string; phone: string }>(customers: T[]): T[][] {
  const groups = new Map<string, T[]>()
  for (const customer of customers) {
    const phone = canonicalCustomerPhone(customer.phone)
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) continue
    const key = `${customer.businessId}:${phone}`
    groups.set(key, [...(groups.get(key) || []), customer])
  }
  return [...groups.values()].filter(group => group.length > 1)
}
