import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/ui/legal-page'
import { company } from '@/lib/company'

export const metadata: Metadata = { title: 'Politică de cookie-uri | BookEasy', description: 'Cookie-urile și stocarea locală folosite de BookEasy.' }

export default function CookiesPage() {
  return (
    <LegalPage title="Politică de cookie-uri" updatedAt="5 octombrie 2026" version="1.0" description="Informații despre cookie-uri, localStorage, sessionStorage și gestionarea preferințelor.">
      <h2>1. Ce sunt cookie-urile?</h2><p>Cookie-urile sunt fișiere de mici dimensiuni salvate de browser. BookEasy folosește și <strong>localStorage</strong> sau <strong>sessionStorage</strong> pentru preferințe locale. Aceste tehnologii nu sunt folosite pentru publicitate comportamentală.</p>
      <h2>2. Cookie-uri strict necesare</h2><p>Acestea asigură autentificarea, securitatea și navigarea. Nu pot fi dezactivate din banner deoarece Platforma nu ar putea funcționa corect.</p>
      <table><thead><tr><th>Nume/categorie</th><th>Scop</th><th>Durată orientativă</th></tr></thead><tbody>
        <tr><td><code>authjs.session-token</code> / varianta <code>__Secure-</code></td><td>Sesiunea autentificată BookEasy</td><td>Durata sesiunii stabilită de sistem</td></tr>
        <tr><td><code>authjs.csrf-token</code>, <code>authjs.callback-url</code></td><td>Protecția autentificării și revenirea la pagina solicitată</td><td>Sesiune / termen scurt</td></tr>
        <tr><td><code>bookeasy_superadmin_business</code></td><td>Acces temporar autorizat al Super Adminului în contul unei afaceri</td><td>8 ore</td></tr>
        <tr><td>Cookie-uri ale procesatorului de plăți</td><td>Securitate și prevenirea fraudei, numai când utilizatorul deschide pagina procesatorului</td><td>Conform politicii procesatorului</td></tr>
      </tbody></table>
      <h2>3. Stocare funcțională în browser</h2><table><thead><tr><th>Cheie</th><th>Tip</th><th>Scop</th></tr></thead><tbody>
        <tr><td><code>bookeasy_cookie_consent_v1</code></td><td>localStorage</td><td>Preferința privind stocarea funcțională și versiunea acordului</td></tr>
        <tr><td><code>bookeasy_customer_info</code></td><td>localStorage, opțional</td><td>Memorarea locală a numelui și telefonului completate la rezervare, numai după acord</td></tr>
        <tr><td>Preferința numelui operatorului</td><td>localStorage, utilizator autentificat</td><td>Afișarea operatorului în conversațiile gestionate din dashboard</td></tr>
        <tr><td><code>bookeasy-install-dismissed</code></td><td>sessionStorage</td><td>Ascunderea bannerului de instalare PWA pentru sesiunea curentă</td></tr>
      </tbody></table>
      <h2>4. Analiză și marketing</h2><div className="legal-callout">La data acestei versiuni, BookEasy nu instalează Google Analytics, Meta Pixel sau alte cookie-uri de marketing pe domeniul bookeasy.ro.</div><p>Dacă vom activa instrumente opționale de analiză sau marketing, acestea vor fi blocate până la consimțământ și politica va fi actualizată.</p>
      <h2>5. Gestionarea preferințelor</h2><p>Poți redeschide setările prin butonul cu simbolul cookie din colțul paginii. Poți șterge cookie-urile și datele locale din setările browserului. Blocarea cookie-urilor strict necesare poate împiedica autentificarea.</p>
      <h2>6. Servicii terțe</h2><p>Hărțile Google, autentificarea OAuth, canalele Meta și paginile procesatorilor de plăți pot folosi propriile tehnologii pe domeniile lor. Consultă politicile acelor furnizori. Detalii suplimentare sunt disponibile în <Link href="/legal/confidentialitate">Politica de confidențialitate</Link>.</p>
      <h2>7. Contact</h2><p>Operator: {company.legalName}, CUI {company.cui}, {company.tradeRegistryNumber}. Întrebări: <a href={`mailto:${company.privacyEmail}`}>{company.privacyEmail}</a>.</p>
    </LegalPage>
  )
}
