import { spawnSync } from 'node:child_process'

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// Existing production releases prepare the database before building. A
// targeted release applies only the invitation schema update before building.
if (process.env.BOOKEASY_DUAL_ACCOUNT_RELEASE === 'true') {
  console.log('Dual-account release: preparing only the account identity schema.')
  run('node', ['scripts/prepare-dual-accounts.mjs'])
  run('npx', ['next', 'build'])
} else if (process.env.BOOKEASY_INVITATION_PLAN_RELEASE === 'true') {
  console.log('Invitation plan release: preparing only the invitation plan schema.')
  run('node', ['scripts/prepare-invitation-plan.mjs'])
  run('npx', ['next', 'build'])
} else if (process.env.BOOKEASY_INVITE_PROMO_RELEASE === 'true') {
  console.log('Invitation promotion release: preparing only the invitation schema.')
  run('node', ['scripts/prepare-business-invitations.mjs'])
  run('npx', ['next', 'build'])
} else if (process.env.BOOKEASY_SKIP_DB_RELEASE_PREP === 'true') {
  console.log('Code-only release: skipping database preparation.')
  run('npx', ['next', 'build'])
} else {
  run('node', ['scripts/ensure-billing-mode-history.mjs'])
  run('npm', ['run', 'build'])
}
