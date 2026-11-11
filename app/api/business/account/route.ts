import { accountDeletionHandlers } from '@/lib/account-deletion-route'
export const maxDuration = 60
export const { POST, DELETE } = accountDeletionHandlers('BUSINESS')
