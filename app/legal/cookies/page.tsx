import { CookiePreferencesButton } from '@/components/cookie-preferences-button'
import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/ui/legal-page'
import { company } from '@/lib/company'

export const metadata: Metadata = { title: 'Politică de cookie-uri | BookEasy', description: 'Cookie-urile și stocarea locală folosite de BookEasy.' }

export default function CookiesPage() {
  return (
    <LegalPage title="Politică de cookie-uri" updatedAt="5 noiembrie 2026" version="1.2" description="Informații despre cookie-uri, localStorage, statistici și gestionarea preferințelor.">
      <h2>1. Ce sunt cookie-urile?</h2><p>Cookie-urile sunt fișiere de mici dimensiuni salvate de browser. BookEasy folosește și <strong>localStorage</strong> sau <strong>sessionStorage</strong> pentru preferințe locale. Măsurarea reclamelor prin Meta Pixel este opțională și pornește numai după acordul separat al vizitatorului.</p>
      <h2>2. Cookie-uri strict necesare</h2><p>Acestea asigură autentificarea, securitatea și navigarea. Nu pot fi dezactivate din banner deoarece Platforma nu ar putea funcționa corect.</p>
      <table><thead><tr><th>Nume/categorie</th><th>Scop</th><th>Durată orientativă</th></tr></thead><tbody>
        <tr><td><code>authjs.session-token</code> / varianta <code>__Secure-</code></td><td>Sesiunea autentificată BookEasy</td><td>Durata sesiunii stabilită de sistem</td></tr>
        <tr><td><code>authjs.csrf-token</code>, <code>authjs.callback-url</code></td><td>Protecția autentificării și revenirea la pagina solicitată</td><td>Sesiune / termen scurt</td></tr>
        <tr><td><code>bookeasy_superadmin_business</code></td><td>Acces temporar autorizat al Super Adminului în contul unei afaceri</td><td>8 ore</td></tr>
        <tr><td>Cookie-uri ale procesatorului de plăți</td><td>Securitate și prevenirea fraudei, numai când utilizatorul deschide pagina procesatorului</td><td>Conform politicii procesatorului</td></tr>
      </tbody></table>
      <h2>3. Stocare funcțională în browser</h2><table><thead><tr><th>Cheie</th><th>Tip</th><th>Scop</th></tr></thead><tbody>
        <tr><td><code>bookeasy_cookie_consent_v2</code></td><td>localStorage</td><td>Preferințele privind stocarea funcțională și Meta Pixel, cu data și versiunea alegerii</td></tr>
        <tr><td><code>bookeasy_customer_info</code></td><td>localStorage, opțional</td><td>Memorarea locală a numelui și telefonului completate la rezervare, numai după acord</td></tr>
        <tr><td>Preferința numelui operatorului</td><td>localStorage, utilizator autentificat</td><td>Afișarea operatorului în conversațiile gestionate din dashboard</td></tr>
        <tr><td><code>bookeasy-install-dismissed</code></td><td>sessionStorage</td><td>Ascunderea bannerului de instalare PWA pentru sesiunea curentă</td></tr>
        <tr><td><code>bookeasy-client-preferred-city-v1</code></td><td>localStorage</td><td>Orașul ales manual în pagina de descoperire; coordonatele GPS nu sunt stocate</td></tr>
        <tr><td><code>bookeasy-client-install-dismissed-v1</code></td><td>localStorage</td><td>Ascunderea permanentă pe acest dispozitiv a bannerului de instalare pentru clienți, după închiderea cu X</td></tr>
        <tr><td><code>bookeasy-client-installed-v1</code></td><td>localStorage</td><td>Ascunderea bannerului după instalarea aplicației pe dispozitiv</td></tr>
      </tbody></table>
      <h2>4. Analiză și marketing</h2><p>Vercel Web Analytics măsoară vizitele pe paginile publice prin statistici agregate, fără cookie-uri terțe. Parametrii din URL care pot conține adrese de email, tokenuri sau alte date private sunt eliminați înainte de transmitere; pe pagina de înscriere păstrăm doar parametrii UTM ai campaniei. BookEasy numără separat, în baza proprie, vizitele, începuturile și trimiterile formularului și conturile create, agregat pe zi și campanie. Aceste contoare nu păstrează emailul, IP-ul sau un identificator de vizitator.</p><p>Dacă este configurat, Meta Pixel se încarcă numai pe pagina de înscriere și numai după acordul separat pentru măsurarea reclamelor. Atunci poate trimite către Meta vizita paginii și evenimentul <code>CompleteRegistration</code> după crearea contului; Meta poate folosi cookie-uri precum <code>_fbp</code> și <code>_fbc</code>. Fără acord, aceste evenimente nu sunt trimise către Meta. BookEasy nu instalează Google Analytics.</p>
      <h2>5. Gestionarea preferințelor</h2><p>Poți modifica oricând alegerea privind memorarea funcțională și măsurarea reclamelor. Poți șterge cookie-urile și datele locale din setările browserului. Blocarea cookie-urilor strict necesare poate împiedica autentificarea.</p><CookiePreferencesButton className="btn-secondary mt-3" />
      <h2>6. Servicii terțe</h2><p>Hărțile Google, autentificarea OAuth, canalele Meta și paginile procesatorilor de plăți pot folosi propriile tehnologii pe domeniile lor. Consultă politicile acelor furnizori. Detalii suplimentare sunt disponibile în <Link href="/legal/confidentialitate">Politica de confidențialitate</Link>.</p>
      <h2>7. Contact</h2><p>Operator: {company.legalName}, CUI {company.cui}, {company.tradeRegistryNumber}. Întrebări: <a href={`mailto:${company.privacyEmail}`}>{company.privacyEmail}</a>.</p>
    </LegalPage>
  )
}
