# Google Wallet pentru rezervări BookEasy

Integrarea este pregătită în cod, dar rămâne oprită până la testarea completă și aprobarea pentru publicare. Nu afișa butonul public înainte de testarea unui card real.

## Starea configurării — 5 noiembrie 2026

- Proiect Cloud dedicat: `bookeasy-wallet` (`612522217386`), cu Google Wallet API activat.
- Cont issuer BookEasy: `3388000000023235887`, în modul demonstrativ.
- Clasa Generic finală: `3388000000023235887.bookeasy_booking`.
- Identitatea publică este **BookEasy**; entitatea juridică pentru profilul Google Payments trebuie să fie **NEXTLEVEL AUTOMATION S.R.L.** Profilul asociat în prezent în consolă este de persoană fizică. Schimbarea asocierii necesită intervenția Google Support.
- Profilul public Wallet a fost completat și salvat cu numele BookEasy, categoria `Digital Goods: Applications (Excludes Games) (5817)`, site-ul `https://bookeasy.ro`, suportul `https://bookeasy.ro/contact`, `contact@bookeasy.ro` și `+40 712 345 002`. Pe 5 noiembrie consola afișează **„Aprobat”** pentru profilul public. Pagina de contact este publicată pe site-ul live. Aprobarea acestui profil nu a schimbat profilul Google Payments asociat, care este încă de persoană fizică.
- Pe 5 noiembrie a fost trimisă din consola Pay & Wallet o cerere de suport pentru asocierea unui profil Google Payments de tip Organizație cu NEXTLEVEL AUTOMATION S.R.L. Google a confirmat trimiterea și a afișat un timp de examinare de până la 36 de ore, cu răspuns prin email. Cererea include merchant ID `BCR2DN6DZL64NJD2` și issuer ID de mai sus.
- Cont tehnic: `bookeasy-wallet-issuer@bookeasy-wallet.iam.gserviceaccount.com`, cu rol **Dezvoltator** în issuer.
- Google Cloud interzice cheile private descărcabile prin `iam.disableServiceAccountKeyCreation`. Poolul OIDC `bookeasy-vercel`, providerul `vercel-bookeasy`, are issuer `https://oidc.vercel.com/pmcustoms` și acceptă numai subiectele Vercel `bookeasy` din `preview` și `production`. Acestea au rolul **Service Account Token Creator** numai pe contul tehnic. IAM Service Account Credentials API este activat.
- Nu există încă acces de publicare. Flagul `GOOGLE_WALLET_ENABLED` rămâne oprit în producție până la corectarea profilului juridic, aprobarea Google și testarea check-in-ului cu o rezervare reală.
- Schimbul OIDC Vercel → Google STS, semnarea JWT prin IAM și salvarea unui permis demonstrativ în Google Wallet au fost verificate pe preview la 4 noiembrie 2026. Permisul de test a fost arhivat după verificare. Ruta temporară de diagnostic a fost eliminată din codul final.
- În timpul configurării a fost creată și o clasă Generic nefolosită cu codul `3388000000023235887.3388000000023235887.bookeasy_booking`; aceasta **nu** este clasa configurată pentru BookEasy.

## Fluxul implementat

Pentru o rezervare web la o afacere Pro dintr-o categorie eligibilă, răspunsul API poate conține un link „Adaugă în Google Wallet”. Cardul generic include numele afacerii, serviciul, data și un QR. QR deschide `/dashboard/check-in?code=...`; numai un utilizator al afacerii respective poate confirma sosirea. API-ul revalidează semnătura codului, planul, categoria, rezervarea, intervalul și faptul că nu s-a făcut deja check-in.

Nu sunt trimise în card numărul de telefon, adresa de email sau informații medicale. Categoriile medicale, psihologice și juridice sunt excluse. Codul QR este semnat HMAC și nu conține date personale.

## Pașii externi necesari

1. Așteaptă răspunsul Google Support la cererea trimisă pe 5 noiembrie și urmează instrucțiunile pentru asocierea unui profil Google Payments de tip **Organizație** pentru NEXTLEVEL AUTOMATION S.R.L. Profilul public BookEasy este deja aprobat; identitatea juridică asociată issuerului rămâne de corectat. Nu schimba doar numele profilului personal, deoarece tipul juridic al contului ar rămâne greșit.
2. Variabilele Wallet din Vercel sunt configurate pentru preview și producție: issuer, clasă, emailul contului tehnic, audiența WIF și secretul QR. Codul schimbă tokenul OIDC Vercel prin Google STS și solicită semnarea JWT prin IAM Credentials; nu este nevoie de cheie privată în Vercel. Flagul `GOOGLE_WALLET_ENABLED` nu este activ în producție.
3. În modul demonstrativ, testează citirea QR, anularea și check-in-ul cu o rezervare și un cont business reale. Salvarea permisului de test a fost deja verificată. După corectarea identității juridice, test și aprobarea profilului de companie, solicită accesul pentru publicare în consola Wallet și setează `GOOGLE_WALLET_ENABLED=true`. Consola arată acum 2 din 3 pași finalizați; accesul de publicare este pasul rămas.

Nu stoca nicio cheie service account în repository și nu dezactiva politica organizației care interzice cheile. Codul păstrează suportul pentru JSON numai pentru alte medii care îl permit; BookEasy folosește OIDC. Rotirea secretului QR invalidează codurile deja emise; păstrează-l stabil după activare.

## Surse Google

- https://developers.google.com/wallet/generic/getting-started/issuer-onboarding
- https://developers.google.com/wallet/generic/getting-started/auth/rest
- https://developers.google.com/wallet/generic/web
- https://developers.google.com/wallet/generic/test-and-go-live/request-publishing-access
- https://support.google.com/console/answer/10877772?hl=en
- https://support.google.com/console/answer/10913634?hl=en
- https://vercel.com/docs/oidc/gcp
- https://docs.cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/signJwt
