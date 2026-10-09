import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/ui/legal-page'
import { company } from '@/lib/company'

export const metadata: Metadata = { title: 'Politică de confidențialitate | BookEasy', description: 'Prelucrarea datelor cu caracter personal în BookEasy, conform GDPR.' }

const processors = [
  ['Vercel Inc.', 'Hosting principal, CDN și funcții serverless', 'UE/SUA, conform configurației și garanțiilor furnizorului'],
  ['Cloudflare Inc.', 'DNS, securitate și stocarea fișierelor în R2', 'Rețea globală; stocare configurată de Furnizor'],
  ['Neon Inc.', 'Baza de date PostgreSQL', 'UE - Frankfurt'],
  ['Resend Inc.', 'E-mail tranzacțional', 'UE/SUA'],
  ['Google LLC', 'Hărți, Calendar și Business Profile, numai dacă sunt activate', 'UE/SUA'],
  ['Meta Platforms Ireland', 'WhatsApp, Facebook și Instagram, numai dacă sunt activate', 'UE/SUA'],
  ['Banca Transilvania / BT iPay', 'Finalizarea eventualelor tranzacții inițiate anterior dezactivării plăților online', 'România/UE'],
]

export default function PrivacyPage() {
  return (
    <LegalPage title="Politică de confidențialitate" updatedAt="9 octombrie 2026" version="2.3" description="Cum colectează, utilizează, protejează și șterge BookEasy datele cu caracter personal.">
      <h2>1. Identitatea operatorului</h2><p>Operatorul platformei este <strong>{company.legalName}</strong>, CUI {company.cui}, {company.tradeRegistryNumber}, cu sediul în {company.registeredAddress}. Pentru întrebări sau exercitarea drepturilor: <a href={`mailto:${company.privacyEmail}`}>{company.privacyEmail}</a>.</p>
      <h2>2. Rolurile privind datele</h2><p>BookEasy acționează ca operator pentru datele necesare administrării conturilor, facturării, securității, suportului și relației contractuale. Pentru datele clienților sau pacienților introduse de o afacere, afacerea stabilește scopurile și mijloacele principale, iar BookEasy acționează ca persoană împuternicită, conform <Link href="/dpa">DPA</Link>.</p>
      <h2>3. Date, scopuri, temeiuri și retenție</h2>
      <table><thead><tr><th>Categorie</th><th>Scop și temei</th><th>Retenție orientativă</th></tr></thead><tbody>
        <tr><td>Cont și contact</td><td>Crearea contului, autentificare, suport și executarea contractului</td><td>Durata contului + termenele legale aplicabile</td></tr>
        <tr><td>Date despre afacere și echipă</td><td>Configurarea serviciilor, programului, personalului și paginii publice</td><td>Durata contractului și perioada de export/ștergere</td></tr>
        <tr><td>Programări și clienți</td><td>Furnizarea serviciului în numele afacerii; temeiul este stabilit de afacere</td><td>Conform instrucțiunilor afacerii și obligațiilor sale</td></tr>
        <tr><td>Facturi și plăți</td><td>Executarea contractului și obligații financiar-contabile</td><td>Conform termenelor legale financiar-contabile</td></tr>
        <tr><td>Contracte și semnături electronice</td><td>Încheierea și dovedirea contractelor cu afacerile: datele juridice ale părților, numele și imaginea semnăturii desenate, contul folosit, momentul semnării, adresa IP, agentul browserului și amprenta documentului. Temei: executarea contractului și interesul legitim de a proba acordul și integritatea documentului.</td><td>Pe durata raportului contractual și ulterior cât este necesar pentru obligații legale sau apărarea drepturilor, potrivit termenelor aplicabile; datele de probă sunt accesibile numai persoanelor autorizate.</td></tr>
        <tr><td>Oraș preferat și locație opțională</td><td>Filtrarea afacerilor din apropiere; coordonatele sunt folosite doar în browser și nu sunt trimise de BookEasy către server sau către integrările externe. Orașul ales manual rămâne în stocarea locală a browserului.</td><td>Orașul ales rămâne până la ștergerea datelor din browser sau la reluarea detectării.</td></tr>
        <tr><td>Jurnale tehnice, IP, dispozitiv</td><td>Securitate, prevenirea abuzului și diagnosticare; interes legitim</td><td>Perioada necesară investigației și politicilor furnizorilor</td></tr>
        <tr><td>Solicitări și mesaje</td><td>Răspuns, suport și gestionarea comunicării</td><td>Cât timp este necesar scopului și apărării drepturilor</td></tr>
      </tbody></table>
      <div className="legal-callout">Plățile online noi sunt dezactivate. BookEasy nu colectează și nu stochează datele complete ale cardului. Tranzacțiile începute anterior pot fi finalizate de procesatorul folosit la inițiere.</div>
      <h2>4. Integrări Google și Meta</h2><h3>Google Calendar și Business Profile</h3><p>Dacă afacerea activează integrarea, BookEasy folosește autorizarea OAuth pentru a sincroniza evenimente sau recenzii. Tokenurile sunt criptate înainte de stocare. Accesul poate fi revocat din BookEasy sau din contul Google. Datele Google nu sunt folosite pentru publicitate și nu sunt vândute; utilizarea respectă Google API Services User Data Policy, inclusiv cerințele Limited Use.</p><h3>WhatsApp, Facebook și Instagram</h3><p>Canalele sunt conectate numai la cererea afacerii. BookEasy poate primi și trimite mesaje, identifica solicitări de programare și păstra istoricul conversației conform configurării afacerii și regulilor Meta.</p>
      <h2>5. Destinatari și subprocesori</h2><p>Accesul este limitat la furnizorii necesari serviciului, obligați contractual să protejeze datele. Lista poate varia în funcție de integrările activate.</p><table><thead><tr><th>Furnizor</th><th>Rol</th><th>Locație/transfer</th></tr></thead><tbody>{processors.map(([name, role, location]) => <tr key={name}><td>{name}</td><td>{role}</td><td>{location}</td></tr>)}</tbody></table>
      <h2>6. Transferuri internaționale</h2><p>Când un furnizor procesează date în afara Spațiului Economic European, sunt utilizate mecanisme recunoscute de GDPR, precum decizii de adecvare, EU-US Data Privacy Framework sau clauze contractuale standard, după caz.</p>
      <h2>7. Securitate</h2><ul><li>conexiuni HTTPS/TLS și controale de acces;</li><li>parole stocate numai sub formă de hash bcrypt;</li><li>tokenuri de integrare criptate la nivelul aplicației;</li><li>separarea logică a datelor pe afaceri și verificarea autorizării în rutele sensibile;</li><li>jurnale, limitarea cererilor și copii de siguranță gestionate prin infrastructura contractată.</li></ul><p>Nicio măsură tehnică nu elimină complet riscul. Incidentele sunt evaluate și notificate conform obligațiilor GDPR.</p>
      <h2>8. Drepturile persoanelor vizate</h2><p>Poți solicita accesul, rectificarea, ștergerea, restricționarea, portabilitatea sau opoziția și poți retrage consimțământul. Răspundem, de regulă, în cel mult 30 de zile, cu posibilitatea prelungirii permise de GDPR. Pentru datele gestionate de o afacere, solicitarea poate trebui adresată mai întâi acelei afaceri.</p><p>Ai dreptul să depui plângere la <a href="https://www.dataprotection.ro/" target="_blank" rel="noopener noreferrer">ANSPDCP</a>.</p>
      <h2>9. Minori și categorii speciale</h2><p>Platforma nu este destinată creării autonome de conturi de către minori. Afacerile din domeniul medical pot introduce date privind sănătatea; ele răspund pentru temeiul Art. 9 GDPR, informarea persoanelor și configurarea accesului personalului.</p>
      <h2>10. Actualizări și contact</h2><p>Actualizările semnificative vor fi publicate aici și, când este rezonabil, comunicate în platformă sau prin e-mail. Contact GDPR: <a href={`mailto:${company.privacyEmail}`}>{company.privacyEmail}</a>.</p>
    </LegalPage>
  )
}
