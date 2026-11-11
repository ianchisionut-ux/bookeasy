import { CATEGORY_LABEL, PUBLIC_CATEGORY_GROUPS } from '@/lib/business-categories'

export function BusinessCategoryOptions() {
  return <>{PUBLIC_CATEGORY_GROUPS.map(group => <optgroup key={group.id} label={group.label}>
    {group.categories.map(category => <option key={category} value={category}>{CATEGORY_LABEL[category]}</option>)}
  </optgroup>)}</>
}
