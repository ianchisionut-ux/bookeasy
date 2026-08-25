import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/ui/legal-page'
import { company } from '@/lib/company'

export const metadata: Metadata = {
  title: 'Politica de confidențialitate | BookEasy',
  description: 'Cum colectează, folosește și protejează BookEasy datele cu caracter personal.',
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Politica de confidențialitate" updatedAt="25 august 2026">
      <p>
        Această politică explică modul în care platforma BookEasy („BookEasy”, „noi”) prelucrează datele
        persoanelor care folosesc site-ul, solicită acces, administrează o afacere sau efectuează o programare.
      </p>

      <h2>Operatorul platformei</h2>
      <p>
        Platforma BookEasy este operată de <strong>{company.legalName}</strong>, cu sediul social în{' '}
        {company.registeredAddress}, CUI {company.cui}, înregistrată la Registrul Comerțului sub nr.{' '}
        {company.tradeRegistryNumber}. Activitatea principală: {company.mainActivity}, CAEN {company.caen}.
      </p>
      <h2>1. Rolurile privind datele</h2>
      <p>
        Pentru datele necesare administrării platformei, securității și relației contractuale, BookEasy acționează
        ca operator. Pentru datele clienților introduse și gestionate de o afacere în BookEasy, afacerea respectivă
        stabilește scopul prelucrării, iar BookEasy furnizează serviciile tehnice necesare.
      </p>

      <h2>2. Date pe care le putem prelucra</h2>
      <ul>
        <li>date de cont și contact, precum numele, adresa de e-mail și numărul de telefon;</li>
        <li>date despre afacere, personal, servicii, disponibilitate și setările contului;</li>
        <li>date despre programări: client, serviciu, dată, oră, specialist și starea programării;</li>
        <li>mesaje și solicitări transmise prin formulare sau prin canalele conectate;</li>
        <li>date tehnice și de securitate, precum adresa IP, tipul dispozitivului și jurnalele de acces;</li>
        <li>date necesare integrărilor activate voluntar, inclusiv Google Calendar și furnizorii de plăți.</li>
      </ul>

      <h2>3. Scopurile și temeiurile prelucrării</h2>
      <p>Folosim datele numai în măsura necesară pentru:</p>
      <ul>
        <li>crearea și administrarea conturilor și furnizarea programărilor;</li>
        <li>trimiterea confirmărilor, reamintirilor și comunicărilor solicitate;</li>
        <li>sincronizarea cu serviciile alese de utilizator;</li>
        <li>procesarea plăților, prevenirea fraudelor și protejarea platformei;</li>
        <li>asistență, remedierea erorilor și îmbunătățirea serviciului;</li>
        <li>respectarea obligațiilor legale.</li>
      </ul>
      <p>
        Temeiul poate fi executarea contractului, consimțământul, interesul legitim privind securitatea și
        funcționarea serviciului sau îndeplinirea unei obligații legale, după caz.
      </p>

      <h2>4. Google Calendar</h2>
      <p>
        Dacă activezi integrarea, BookEasy folosește autorizarea Google pentru a crea, actualiza și elimina din
        calendar evenimente asociate programărilor. În funcție de setările alese, evenimentul poate include numele,
        telefonul și serviciul clientului. Integrarea poate fi deconectată oricând din setările BookEasy sau din
        contul Google. BookEasy nu folosește datele Google Calendar pentru publicitate și nu le vinde.
      </p>

      <h2>5. Destinatari și furnizori</h2>
      <p>
        Datele pot fi prelucrate de furnizori de găzduire, e-mail, mesagerie, plăți, analiză tehnică și integrări,
        strict pentru prestarea serviciilor. Putem divulga date și autorităților atunci când legea ne obligă.
        Nu vindem date cu caracter personal.
      </p>

      <h2>6. Transferuri internaționale</h2>
      <p>
        Unii furnizori pot prelucra date în afara Spațiului Economic European. În aceste situații sunt utilizate
        mecanisme legale adecvate, precum decizii de adecvare sau clauze contractuale standard.
      </p>

      <h2>7. Păstrarea și securitatea datelor</h2>
      <p>
        Păstrăm datele atât timp cât contul este activ și cât este necesar pentru scopurile descrise, obligațiile
        legale și soluționarea eventualelor litigii. Aplicăm măsuri tehnice și organizatorice rezonabile, însă nicio
        transmitere sau stocare electronică nu poate fi garantată ca fiind complet lipsită de risc.
      </p>

      <h2>8. Drepturile tale</h2>
      <p>
        În condițiile Regulamentului (UE) 2016/679, poți solicita accesul, rectificarea, ștergerea, restricționarea
        sau portabilitatea datelor, te poți opune anumitor prelucrări și îți poți retrage consimțământul. De asemenea,
        poți depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal.
      </p>

      <h2>9. Contact și actualizări</h2>
      <p>
        Pentru întrebări sau exercitarea drepturilor, folosește formularul de contact de pe{' '}
        <Link href="/#cere-acces">pagina principală</Link>. Putem actualiza această politică atunci când serviciile
        sau cerințele legale se schimbă; versiunea curentă va fi publicată aici, împreună cu data actualizării.
      </p>
    </LegalPage>
  )
}
