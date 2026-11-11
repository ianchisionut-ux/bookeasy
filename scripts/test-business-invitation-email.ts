import assert from 'node:assert/strict'
import {businessInvitationEmail,validInvitationHeader} from '../lib/business-invitation-email'

const invite=businessInvitationEmail({businessName:'Salon <Nou>',offerDescription:'Plan STANDARD & 55 lei/lună',ctaUrl:'https://bookeasy.ro/invitatie-afacere/test',existing:false})
assert.match(invite.html,/bookeasy-invitation-header-wide\.jpg/)
assert.match(invite.html,/max-width:1400px/)
assert.match(invite.html,/Salon &lt;Nou&gt;/)
assert.match(invite.html,/STANDARD &amp; 55/)
assert.match(invite.html,/Vreau să îmi înscriu afacerea/)
assert.match(invite.html,/href="tel:\+40712345002"/)
assert.match(invite.text,/contact@bookeasy\.ro · \+40 712 345 002/)
assert.ok(invite.html.indexOf('Oferta din invitația ta')<invite.html.indexOf('Vreau să îmi înscriu afacerea'))
assert.match(invite.text,/Rezervări într-un singur loc/)
assert.equal(validInvitationHeader('https://evil.example/banner.jpg'),null)
assert.equal(validInvitationHeader('/api/storage/public/public/invitation-headers/00000000-0000-4000-8000-000000000000.jpg'),'/api/storage/public/public/invitation-headers/00000000-0000-4000-8000-000000000000.jpg')
console.log('Business invitation email checks passed.')
