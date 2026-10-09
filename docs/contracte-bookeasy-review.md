# Contracte BookEasy și semnare în aplicație

## Adaptarea modelelor Daily Menu

Cele două modele furnizate au fost folosite ca referință pentru contractul de servicii și acordul de prelucrare a datelor. Textele din aplicație sunt în `lib/business-contracts.ts`, versiunea `2026-10-09.1`. Ele folosesc automat datele juridice ale businessului, planul și tariful salvate în BookEasy. Fiecare semnare păstrează un instantaneu al textului și al datelor.

Clauzele despre restaurante, meniuri, KDS, livrare, curieri, alergeni și `dailym.ro` au fost înlocuite cu funcțiile BookEasy: programări, rezervări, echipă, pagină publică, comunicări și integrări activate. Acordul GDPR include posibilitatea prelucrării datelor privind sănătatea de către clinici. Nu preia afirmațiile din model despre baze de date separate pe restaurant, SQLite sau termene automate de ștergere care nu sunt demonstrate pentru BookEasy.

Modelul Daily Menu avea anexe comerciale și termene fixe de răspuns, penalități și retenție. Acestea nu au fost copiate ca promisiuni standard. Planul și tariful vin din câmpurile de facturare; dacă lipsesc, contractul de servicii nu se poate semna. Scadența este cea de pe factură. Orice SLA, termen de retenție garantat, penalitate sau durată minimă trebuie stabilite separat și revizuite înainte de adăugare.

## Dovezi păstrate la semnare

- Textul exact al documentului și amprenta SHA-256 a conținutului.
- Numele semnatarului, contul autentificat, data și ora serverului, imaginea desenată, IP-ul și agentul browserului.
- Confirmarea expresă a autorității de reprezentare.
- Contrasemnătura separată a furnizorului în Super Admin.
- Exemplarul poate fi deschis și salvat ca PDF din browser.

Acesta este un flux de **semnătură electronică simplă**. Nu oferă identificare la nivel substanțial/ridicat, certificat calificat, marcă temporală calificată sau garanția că semnătura este echivalentă în toate cazurile cu semnătura olografă. O bază de date administrată de furnizor nu este, singură, un serviciu independent de încredere.

## Revizuire juridică înainte de activarea în producție

Un avocat și, pentru DPA, un specialist GDPR trebuie să verifice textul comercial, categoriile de date ale clinicilor, furnizorii și regiunile de prelucrare, transferurile internaționale, retenția, temeiurile pentru date medicale și persoanele autorizate să semneze. Pentru documente cu cerință legală de formă sau risc mare de contestare, se recomandă integrarea unui furnizor de semnături calificate.

Referințe: [GDPR art. 28](https://eur-lex.europa.eu/eli/reg/2016/679/oj), [eIDAS art. 25](https://eur-lex.europa.eu/eli/reg/2014/910/oj), [Legea 214/2024 art. 3-5](https://legislatie.just.ro/Public/DetaliiDocumentAfis/285178).
