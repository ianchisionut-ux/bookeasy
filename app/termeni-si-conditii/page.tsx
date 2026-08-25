import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/ui/legal-page'
import { company } from '@/lib/company'

export const metadata: Metadata = {
  title: 'Termeni și condiții | BookEasy',
  description: 'Condițiile generale pentru utilizarea platformei BookEasy.',
}

export default function TermsPage() {
  return (
    <LegalPage title="Termeni și condiții" updatedAt="25 august 2026">
      <p>
        Acești termeni reglementează accesul și utilizarea platformei BookEasy. Prin crearea unui cont, conectarea
        unei integrări sau efectuarea unei programări, confirmi că ai citit și accepți condițiile aplicabile.
      </p>

      <h2>Furnizorul platformei</h2>
      <p>
        BookEasy este furnizat de <strong>{company.legalName}</strong>, cu sediul social în{' '}
        {company.registeredAddress}, CUI {company.cui}, nr. Registrul Comerțului {company.tradeRegistryNumber},
        având ca activitate principală {company.mainActivity} (CAEN {company.caen}).
      </p>
      <h2>1. Serviciul BookEasy</h2>
      <p>
        BookEasy oferă instrumente pentru administrarea programărilor, disponibilității, clienților, mesajelor,
        notificărilor și integrărilor. Funcțiile disponibile pot varia în funcție de planul și setările afacerii.
      </p>

      <h2>2. Relația dintre client și afacere</h2>
      <p>
        Afacerile listate în platformă sunt independente și răspund pentru serviciile oferite, prețuri,
        disponibilitate, condiții de anulare, documente fiscale și respectarea obligațiilor profesionale. BookEasy
        facilitează programarea și nu devine prestatorul serviciului rezervat de client.
      </p>

      <h2>3. Conturi și responsabilități</h2>
      <ul>
        <li>informațiile furnizate trebuie să fie corecte, actuale și complete;</li>
        <li>datele de autentificare trebuie păstrate confidențial;</li>
        <li>administratorul contului răspunde pentru utilizatorii, personalul și setările asociate;</li>
        <li>orice utilizare neautorizată sau incident de securitate trebuie raportat fără întârziere.</li>
      </ul>

      <h2>4. Programări, anulări și neprezentări</h2>
      <p>
        O programare este supusă regulilor afișate sau comunicate de afacerea aleasă. Clientul trebuie să verifice
        datele programării și să anunțe afacerea dacă dorește modificarea sau anularea. Reamintirile sunt o funcție
        auxiliară, iar lipsa unei notificări nu anulează programarea.
      </p>

      <h2>5. Plăți</h2>
      <p>
        Dacă o afacere activează plata sau avansul online, tranzacția este procesată prin furnizorul de plăți indicat.
        Taxele, rambursările și condițiile de anulare sunt cele prezentate la rezervare și cele stabilite de afacere.
        BookEasy nu stochează datele complete ale cardului.
      </p>

      <h2>6. Integrări externe</h2>
      <p>
        Conectarea Google Calendar, a canalelor de mesagerie sau a altor servicii este opțională și presupune și
        acceptarea termenilor furnizorului respectiv. Utilizatorul poate revoca accesul. Disponibilitatea unei
        integrări poate depinde de serviciul extern și de conexiunea la internet.
      </p>

      <h2>7. Utilizare acceptabilă</h2>
      <p>Este interzisă folosirea platformei pentru:</p>
      <ul>
        <li>activități ilegale, frauduloase, înșelătoare sau abuzive;</li>
        <li>acces neautorizat, perturbarea serviciului sau testarea vulnerabilităților fără permisiune;</li>
        <li>transmiterea de conținut malițios, spam sau date fără un temei legal;</li>
        <li>încălcarea drepturilor altor persoane ori a regulilor canalelor conectate.</li>
      </ul>

      <h2>8. Disponibilitate și modificări</h2>
      <p>
        Urmărim funcționarea stabilă a platformei, dar nu garantăm disponibilitatea neîntreruptă. Putem efectua
        mentenanță, modifica funcții sau suspenda accesul pentru securitate, încălcarea termenilor ori obligații
        legale. Modificările importante vor fi comunicate prin mijloace rezonabile.
      </p>

      <h2>9. Proprietate intelectuală</h2>
      <p>
        Platforma, marca, designul și componentele software BookEasy sunt protejate de lege. Utilizatorul păstrează
        drepturile asupra conținutului propriu și acordă BookEasy permisiunea limitată de a-l prelucra doar pentru
        furnizarea serviciului.
      </p>

      <h2>10. Răspundere</h2>
      <p>
        În limitele permise de lege, BookEasy nu răspunde pentru serviciile furnizate de afaceri, informațiile
        introduse de acestea, acțiunile utilizatorilor sau întreruperile serviciilor externe. Nimic din acești termeni
        nu limitează drepturile consumatorilor și nici răspunderea care nu poate fi exclusă prin lege.
      </p>

      <h2>11. Încetarea utilizării</h2>
      <p>
        Utilizatorul poate solicita închiderea contului. Putem suspenda sau închide un cont care încalcă termenii,
        prezintă un risc de securitate ori nu își îndeplinește obligațiile de plată, cu respectarea legii și a
        condițiilor contractuale aplicabile.
      </p>

      <h2>12. Legea aplicabilă și contact</h2>
      <p>
        Acești termeni se interpretează potrivit legislației române și normelor obligatorii ale Uniunii Europene.
        Eventualele neînțelegeri vor fi soluționate mai întâi pe cale amiabilă, fără a afecta dreptul consumatorilor
        de a se adresa autorităților sau instanțelor competente. Pentru întrebări, folosește formularul de pe{' '}
        <Link href="/#cere-acces">pagina principală</Link>.
      </p>

      <p>
        Prelucrarea datelor personale este descrisă separat în{' '}
        <Link href="/politica-de-confidentialitate">Politica de confidențialitate</Link>.
      </p>
    </LegalPage>
  )
}
