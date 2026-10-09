import type { Metadata } from 'next'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { LegalPage } from '@/components/ui/legal-page'
import { company } from '@/lib/company'

export const metadata: Metadata = {
  title: 'DPA – Acord de prelucrare a datelor | BookEasy',
  description: 'Acordul privind prelucrarea datelor cu caracter personal, conform Art. 28 GDPR.',
}

export default function DpaPage() {
  return (
    <LegalPage title="DPA – Acord de prelucrare a datelor" updatedAt="5 octombrie 2026" version="1.0" description="Acord aplicabil raportului dintre clientul business, în calitate de operator, și BookEasy, în calitate de persoană împuternicită.">
      <div className="legal-callout"><strong>Părțile:</strong> clientul business identificat în cont și {company.legalName}, CUI {company.cui}, {company.tradeRegistryNumber}, cu sediul în {company.registeredAddress}. Exemplarul completat și semnat pentru afacerea ta este disponibil în Setări și prevalează asupra acestui model public dacă textele diferă.</div>
      <p><a className="btn-primary inline-flex items-center gap-2 no-underline" href="/legal/dpa-bookeasy.pdf" download><Download size={16} /> Descarcă DPA în format PDF</a></p>
      <h2>1. Obiect și durată</h2><p>BookEasy prelucrează date personale în numele clientului business exclusiv pentru furnizarea, securizarea și administrarea platformei. Prelucrarea durează pe perioada abonamentului și ulterior numai cât impun obligațiile legale, soluționarea incidentelor sau instrucțiunile documentate privind exportul și ștergerea datelor.</p>
      <h2>2. Categorii de date și persoane vizate</h2><p>Pot fi prelucrate date ale reprezentanților și personalului clientului, precum și ale clienților finali: nume, telefon, adresă de e-mail, detalii despre programări, servicii, facturare, conversații și, dacă funcțiile alese o cer, documente încărcate. Clientul decide categoriile și scopurile concrete.</p>
      <h2>3. Instrucțiuni și obligații</h2><p>BookEasy prelucrează datele numai pe baza instrucțiunilor documentate ale clientului, inclusiv transferurile internaționale. Dacă o obligație legală impune altă prelucrare, clientul va fi informat înainte, în măsura permisă de lege. Persoanele autorizate sunt ținute de confidențialitate.</p>
      <h2>4. Securitate</h2><p>Sunt aplicate măsuri tehnice și organizatorice proporționale cu riscul: control al accesului, autentificare, conexiuni criptate, jurnalizare operațională, copii de siguranță și proceduri de răspuns la incidente. Clientul răspunde de configurarea accesului propriu, de utilizatorii autorizați și de legalitatea datelor introduse.</p>
      <h2>5. Subîmputerniciți</h2><p>Clientul acordă o autorizare generală pentru furnizorii necesari găzduirii, bazei de date, stocării, e-mailului, autentificării, integrărilor și plăților. Lista și categoriile actuale sunt descrise în <Link href="/legal/confidentialitate">Politica de confidențialitate</Link>. BookEasy impune obligații de protecție echivalente și rămâne răspunzător pentru obligațiile sale.</p>
      <h2>6. Transferuri internaționale</h2><p>Când un furnizor prelucrează date în afara Spațiului Economic European, BookEasy folosește un mecanism permis de GDPR, precum o decizie de adecvare sau Clauzele Contractuale Standard, împreună cu măsuri suplimentare unde este necesar.</p>
      <h2>7. Drepturile persoanelor vizate</h2><p>Ținând cont de natura prelucrării, BookEasy sprijină clientul prin măsuri tehnice și informații rezonabile pentru soluționarea cererilor de acces, rectificare, ștergere, restricționare, portabilitate sau opoziție. Clientul rămâne punctul principal de contact pentru persoanele vizate.</p>
      <h2>8. Incidente și conformitate</h2><p>BookEasy notifică fără întârzieri nejustificate clientul despre o încălcare a securității datelor personale de care ia cunoștință și oferă informațiile disponibile necesare evaluării și notificării. La cerere rezonabilă, furnizează informații pentru demonstrarea conformității și permite audituri proporționale, cu protejarea securității și a confidențialității celorlalți clienți.</p>
      <h2>9. Returnarea și ștergerea datelor</h2><p>La încetarea serviciilor, clientul poate solicita exportul disponibil și ștergerea datelor, cu excepția copiilor păstrate temporar în backup sau a informațiilor a căror conservare este impusă de lege. Aceste copii rămân protejate și sunt eliminate conform ciclului tehnic aplicabil.</p>
      <h2>10. Ordinea documentelor și contact</h2><p>Acest DPA completează Termenii și Condițiile. În privința prelucrării datelor în numele clientului, DPA prevalează. Pentru solicitări: <a href={`mailto:${company.privacyEmail}`}>{company.privacyEmail}</a>.</p>
    </LegalPage>
  )
}
