import { createHash } from 'node:crypto'
import type { Business, ContractDocumentType } from '@prisma/client'
import { company } from '@/lib/company'

export const CONTRACT_VERSION = '2026-10-09.1'

export type ContractSection = { heading: string; paragraphs: string[] }
export type ContractDocument = {
  type: ContractDocumentType
  version: string
  title: string
  subtitle: string
  provider: string[]
  customer: string[]
  sections: ContractSection[]
}

type ContractBusiness = Pick<Business,
  'name' | 'slug' | 'category' | 'contactPhone' | 'address' | 'city' |
  'billingLegalName' | 'billingClientType' | 'billingCif' | 'billingRegCom' |
  'billingAddress' | 'billingCounty' | 'billingCity' | 'billingPostalCode' |
  'billingEmail' | 'contractRepresentativeName' | 'contractRepresentativeRole' |
  'planName' | 'billingSubtotal' | 'billingAmount' | 'billingVatRate' |
  'billingCurrency' | 'billingStatus'
>

const provider = [
  company.legalName,
  `CUI ${company.cui}; Registrul Comerțului ${company.tradeRegistryNumber}`,
  `Sediu: ${company.registeredAddress}`,
  `E-mail contractual: ${company.legalEmail}`,
  `Reprezentant: ${company.representativeName}, ${company.representativeRole}`,
]

const categoryLabel: Record<string, string> = {
  SALON: 'salon', CLINICA: 'clinică', EVENT_VENUE: 'spațiu de evenimente',
  HOTEL: 'hotel', PENSIUNE: 'pensiune',
}

export function contractMissingFields(business: ContractBusiness, type: ContractDocumentType) {
  const missing: string[] = []
  if (!business.billingLegalName?.trim()) missing.push('denumire legală sau nume')
  if (business.billingClientType === 'PJ' && !business.billingCif?.trim()) missing.push('CUI/CIF')
  if (!business.billingAddress?.trim()) missing.push('adresă legală')
  if (!business.billingCity?.trim()) missing.push('localitate legală')
  if (!business.billingEmail?.trim()) missing.push('e-mail contractual')
  if (!business.contractRepresentativeName?.trim()) missing.push('numele reprezentantului')
  if (type === 'SERVICES' && !business.planName?.trim()) missing.push('planul comercial')
  if (type === 'SERVICES' && business.billingStatus !== 'GRATUIT' && business.billingSubtotal === null && business.billingAmount === null) missing.push('prețul abonamentului')
  return missing
}

function customerLines(b: ContractBusiness) {
  return [
    `${b.billingLegalName || b.name} (${b.billingClientType === 'PF' ? 'persoană fizică' : 'persoană juridică'})`,
    b.billingCif ? `${b.billingClientType === 'PF' ? 'Identificator fiscal declarat' : 'CUI/CIF'}: ${b.billingCif}` : '',
    b.billingClientType === 'PJ' && b.billingRegCom ? `Registrul Comerțului: ${b.billingRegCom}` : '',
    `Adresă: ${[b.billingAddress, b.billingCity, b.billingCounty, b.billingPostalCode].filter(Boolean).join(', ')}`,
    `E-mail contractual: ${b.billingEmail || '—'}`,
    b.contactPhone ? `Telefon: ${b.contactPhone}` : '',
    `Reprezentant: ${b.contractRepresentativeName || '—'}${b.contractRepresentativeRole ? `, ${b.contractRepresentativeRole}` : ''}`,
  ].filter(Boolean)
}

function serviceDocument(b: ContractBusiness): ContractDocument {
  const amountText = b.billingStatus === 'GRATUIT'
    ? 'gratuit conform stării contului, până la comunicarea și acceptarea unui tarif ulterior'
    : b.billingSubtotal !== null
      ? `${Number(b.billingSubtotal).toFixed(2)} ${b.billingCurrency} fără TVA; TVA ${Number(b.billingVatRate)}% dacă este aplicabil`
      : b.billingAmount !== null ? `${Number(b.billingAmount).toFixed(2)} ${b.billingCurrency} total conform facturii` : 'nespecificat'
  const location = [b.address, b.city].filter(Boolean).join(', ')
  return {
    type: 'SERVICES', version: CONTRACT_VERSION,
    title: 'Contract de furnizare a serviciilor BookEasy',
    subtitle: 'Acces la platforma de programări și rezervări pentru profesioniști',
    provider, customer: customerLines(b),
    sections: [
      { heading: '1. Obiectul și configurația serviciului', paragraphs: [
        `BookEasy oferă Beneficiarului acces la platforma SaaS pentru administrarea activității ${categoryLabel[b.category] || 'afacerii'}, a programărilor sau rezervărilor, a clienților, a echipei și a comunicărilor activate în cont. Profilul comercial este „${b.name}”, la ${location || 'adresa din profil'}, cu pagina bookeasy.ro/${b.slug}.`,
        'Funcțiile efectiv disponibile sunt cele activate în cont și în planul comercial. Integrările cu mesageria, plățile sau furnizori externi se aplică numai dacă sunt configurate. Prestarea serviciului nu transferă codul sursă, domeniul bookeasy.ro sau proprietatea asupra platformei.',
      ] },
      { heading: '2. Durata și activarea', paragraphs: [
        'Contractul intră în vigoare după semnarea sau acceptarea sa de ambele părți. În lipsa unei durate speciale convenite în scris, este pe durată nedeterminată și poate fi denunțat cu preaviz de 30 de zile. Accesul la funcțiile plătite depinde de activarea contului și de plata conform planului.',
      ] },
      { heading: '3. Planul și plata', paragraphs: [
        `Plan: ${b.planName || 'nespecificat'}. Abonament: ${amountText}. Scadența și perioada facturată sunt cele comunicate în cont și pe factura emisă. Configurările sau dezvoltările suplimentare necesită ofertă și acceptare separate.`,
        'Schimbarea tarifului se comunică înainte cu cel puțin 30 de zile; Beneficiarul poate înceta serviciul înainte de aplicarea noului tarif dacă nu îl acceptă. Comisioanele procesatorilor și costurile furnizorilor terți nu sunt incluse decât dacă oferta prevede expres.',
      ] },
      { heading: '4. Dreptul de utilizare și pagina publică', paragraphs: [
        'Beneficiarul primește un drept limitat, neexclusiv și netransferabil de utilizare a platformei pe durata contractului. BookEasy poate pune la dispoziție profilul public, linkul de rezervare, listarea și aplicația web progresivă. Structura adreselor poate fi modificată din motive tehnice, cu eforturi rezonabile de redirecționare a linkurilor active.',
      ] },
      { heading: '5. Obligațiile părților', paragraphs: [
        'BookEasy menține și actualizează serviciul, aplică măsuri rezonabile de securitate și oferă suport prin canalele afișate în platformă. Disponibilitatea neîntreruptă nu poate fi garantată; mentenanța semnificativă este comunicată când este practic posibil.',
        'Beneficiarul furnizează informații corecte, configurează serviciile, duratele, prețurile, programul și persoanele autorizate și menține autorizațiile necesare propriei activități. El răspunde pentru calitatea serviciului prestat clientului final, anulări, rambursări, fiscalizare și reclamațiile privind activitatea sa.',
      ] },
      { heading: '6. Integrări și plăți', paragraphs: [
        'Canalele Meta, WhatsApp, hărțile, calendarele și procesatorii de plăți sunt supuși propriilor condiții. Beneficiarul activează numai integrările necesare și asigură temeiul legal pentru datele transmise. Când plățile sunt activate, încasările destinate Beneficiarului sunt procesate de furnizorul ales; BookEasy oferă integrarea tehnică.',
      ] },
      { heading: '7. Date personale și confidențialitate', paragraphs: [
        'Pentru datele clienților finali și ale personalului prelucrate în numele Beneficiarului, raportul dintre părți este detaliat în Acordul de prelucrare a datelor (DPA), semnat separat. Pentru propriile date de cont, securitate și facturare, furnizorul poate avea rol de operator distinct.',
        'Fiecare parte păstrează confidențiale informațiile tehnice și comerciale ale celeilalte. Beneficiarul păstrează drepturile asupra conținutului său și acordă BookEasy dreptul limitat de a-l găzdui și afișa pentru prestarea serviciului.',
      ] },
      { heading: '8. Suspendare, încetare și export', paragraphs: [
        'Accesul poate fi suspendat pentru neplată după notificarea din cont sau de pe factură, pentru risc de securitate ori folosire ilegală. La încetare, Beneficiarul poate solicita exportul datelor disponibile; returnarea, ștergerea și păstrarea legală urmează DPA și legislația aplicabilă.',
      ] },
      { heading: '9. Răspundere și litigii', paragraphs: [
        'Fiecare parte răspunde potrivit legii pentru încălcările imputabile. Nicio limitare contractuală nu restrânge drepturile persoanelor vizate, răspunderea ce nu poate fi limitată legal sau competențele autorităților. Legea aplicabilă este legea română; părțile încearcă întâi soluționarea amiabilă.',
      ] },
      { heading: '10. Documente și semnături', paragraphs: [
        'Planul și prețul afișate în acest exemplar sunt un instantaneu al datelor din cont la momentul semnării. Modificările ulterioare nu schimbă acest exemplar și cer un nou acord când afectează condițiile contractuale. DPA prevalează pentru prelucrarea datelor personale.',
        'Semnarea prin desen pe ecran și confirmarea din cont sunt consemnate ca semnătură electronică simplă, împreună cu data și evidența tehnică. Acest flux nu emite o semnătură electronică calificată.',
      ] },
    ],
  }
}

function dpaDocument(b: ContractBusiness): ContractDocument {
  return {
    type: 'DPA', version: CONTRACT_VERSION,
    title: 'Acord privind prelucrarea datelor cu caracter personal',
    subtitle: 'Anexă la contractul BookEasy, în temeiul articolului 28 GDPR',
    provider, customer: customerLines(b),
    sections: [
      { heading: '1. Roluri, obiect și durată', paragraphs: [
        'Beneficiarul este operatorul datelor introduse pentru propria activitate, iar NEXTLEVEL AUTOMATION S.R.L. este persoana împuternicită în măsura în care prelucrează acele date în numele său. Acordul se aplică pe durata folosirii BookEasy și cât timp datele sunt păstrate pentru returnare, ștergere sau obligații legale.',
        'Datele prelucrate pot privi clienți sau pacienți, potențiali clienți, personal și colaboratori: identificare, contact, programări sau rezervări, servicii, conversații, plăți și fișiere încărcate prin funcțiile activate. Pentru clinici, pot apărea date privind sănătatea; operatorul stabilește temeiul și garanțiile suplimentare aplicabile.',
      ] },
      { heading: '2. Instrucțiuni și scopuri', paragraphs: [
        'BookEasy prelucrează datele numai pe baza instrucțiunilor documentate ale operatorului, inclusiv configurările făcute în cont și solicitările de suport, pentru furnizarea, securizarea, întreținerea și administrarea funcțiilor activate. Dacă o instrucțiune pare contrară legii, împuternicitul informează operatorul. O obligație legală de prelucrare în afara instrucțiunilor este comunicată înainte, dacă legea permite.',
      ] },
      { heading: '3. Confidențialitate și securitate', paragraphs: [
        'Accesul este limitat la persoane autorizate, supuse confidențialității. Măsurile includ separarea logică a datelor pe business, autentificare și verificări de rol, HTTPS, controlul secretelor, stocare privată a documentelor, jurnalizare tehnică, copii de siguranță și proceduri de incident. Operatorul securizează propriile conturi, dispozitive și drepturi acordate personalului.',
        'Măsurile se adaptează riscului și pot fi înlocuite cu măsuri echivalente fără reducerea nivelului general de protecție. Datele medicale și documentele încărcate trebuie accesate numai de personalul autorizat de operator.',
      ] },
      { heading: '4. Subîmputerniciți și transferuri', paragraphs: [
        'Operatorul acordă autorizare generală pentru furnizorii necesari găzduirii, bazei de date, stocării fișierelor, e-mailului și comunicațiilor activate. La data acestei versiuni, infrastructura BookEasy folosește Vercel pentru găzduire și stocarea fișierelor, Neon pentru baza de date și Resend pentru e-mailurile activate. Integrările Meta, Google și procesatorii de plată se aplică numai când sunt activate pentru business și pot avea roluri juridice distincte. Schimbările de subîmputerniciți sunt comunicate prin platformă sau e-mail, cu posibilitatea unei obiecții motivate.',
        'Transferurile în afara SEE sunt efectuate numai în baza unui mecanism legal aplicabil, precum decizia de adecvare sau clauzele contractuale standard, cu măsuri suplimentare când sunt necesare. Integrările alese de operator pot implica furnizori care au roluri contractuale distincte.',
      ] },
      { heading: '5. Asistență, incidente și audit', paragraphs: [
        'BookEasy sprijină operatorul, ținând seama de informațiile disponibile, pentru cererile persoanelor vizate, securitatea prelucrării, notificarea incidentelor, evaluările de impact și consultarea prealabilă. Incidentele relevante sunt comunicate fără întârzieri nejustificate după confirmare, cu informațiile disponibile, care pot fi completate ulterior.',
        'La cerere rezonabilă, împuternicitul furnizează informații necesare demonstrării conformității și permite audituri proporționale, protejând datele altor clienți și secretele tehnice. Operatorul păstrează responsabilitatea pentru temeiul legal, informări și răspunsurile către persoanele vizate.',
      ] },
      { heading: '6. Returnare și ștergere', paragraphs: [
        'La încetarea serviciului, datele prelucrate în numele operatorului sunt returnate sau șterse, la alegerea acestuia, în limita funcțiilor disponibile și cu excepția păstrării impuse de lege. Copiile de siguranță sunt protejate și eliminate conform ciclului tehnic documentat. Perioadele concrete de păstrare configurate de operator sau impuse legal prevalează asupra unui termen general.',
      ] },
      { heading: '7. Ordinea documentelor și semnături', paragraphs: [
        'În privința prelucrării în numele operatorului, acest DPA prevalează față de contractul comercial. Pentru propriile date de cont, facturare și securitate, BookEasy acționează potrivit politicii sale de confidențialitate.',
        'Părțile pot semna prin fluxul electronic din cont. Desenul semnăturii pe ecran și confirmarea sunt păstrate ca semnătură electronică simplă, cu evidența tehnică a acceptării; nu reprezintă o semnătură electronică calificată.',
      ] },
      { heading: '8. Descrierea prelucrării', paragraphs: [
        'Natura operațiunilor: colectare, înregistrare, organizare, stocare, consultare, transmitere la instrucțiunea operatorului, restricționare, export și ștergere. Scopurile: programări și rezervări, comunicări cu clienții, administrarea echipei, integrarea funcțiilor activate, suport și securitate. Prelucrarea este continuă pe durata serviciului, iar integrările funcționează numai dacă sunt activate.',
        'Persoane vizate: clienți sau pacienți, potențiali clienți, reprezentanți și personal. Categorii de date: nume, contact, detalii ale programărilor, conversații, identificatori de canal, date de facturare și fișiere introduse de operator. Pentru o clinică, fișierele și observațiile pot include date privind sănătatea, care impun garanții suplimentare și control strict al accesului.',
        'Păstrarea datelor este determinată de configurația serviciului, instrucțiunile operatorului, ciclul copiilor de siguranță și obligațiile legale aplicabile. Părțile documentează separat orice termen sau procedură de ștergere care trebuie garantată contractual; acest acord nu promite un termen automat pentru toate categoriile.',
      ] },
    ],
  }
}

export function buildContractDocument(business: ContractBusiness, type: ContractDocumentType): ContractDocument {
  return type === 'DPA' ? dpaDocument(business) : serviceDocument(business)
}

export function documentHash(document: ContractDocument) {
  return createHash('sha256').update(JSON.stringify(document)).digest('hex')
}
