from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "dpa-bookeasy-v1.0.pdf"
PUBLIC = ROOT / "public" / "legal" / "dpa-bookeasy.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
PUBLIC.parent.mkdir(parents=True, exist_ok=True)

font_dir = Path("C:/Windows/Fonts")
pdfmetrics.registerFont(TTFont("BookEasy", str(font_dir / "arial.ttf")))
pdfmetrics.registerFont(TTFont("BookEasyBold", str(font_dir / "arialbd.ttf")))

TEAL = colors.HexColor("#178F92")
GREEN = colors.HexColor("#7FBD42")
INK = colors.HexColor("#263B3F")
MUTED = colors.HexColor("#687477")
LINE = colors.HexColor("#D9E6E4")
SOFT = colors.HexColor("#E8F7F6")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverTag", fontName="BookEasyBold", fontSize=10, leading=13, textColor=TEAL, alignment=TA_CENTER, spaceAfter=12))
styles.add(ParagraphStyle(name="CoverTitle", fontName="BookEasyBold", fontSize=25, leading=30, textColor=INK, alignment=TA_CENTER, spaceAfter=15))
styles.add(ParagraphStyle(name="CoverBody", fontName="BookEasy", fontSize=11, leading=17, textColor=MUTED, alignment=TA_CENTER, spaceAfter=12))
styles.add(ParagraphStyle(name="H1x", fontName="BookEasyBold", fontSize=17, leading=22, textColor=INK, spaceBefore=12, spaceAfter=8))
styles.add(ParagraphStyle(name="H2x", fontName="BookEasyBold", fontSize=12, leading=16, textColor=TEAL, spaceBefore=11, spaceAfter=5))
styles.add(ParagraphStyle(name="Bodyx", fontName="BookEasy", fontSize=9.5, leading=14.5, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name="Smallx", fontName="BookEasy", fontSize=8, leading=11, textColor=MUTED))

sections = [
    ("1. Obiectul acordului", "BookEasy prelucrează date cu caracter personal în numele Clientului exclusiv pentru furnizarea, securizarea și administrarea platformei BookEasy. Prezentul acord completează Termenii și Condițiile și se aplică tuturor prelucrărilor efectuate de BookEasy în calitate de persoană împuternicită."),
    ("2. Durata prelucrării", "Prelucrarea are loc pe durata abonamentului și ulterior numai atât cât este necesar pentru exportul sau ștergerea datelor, pentru soluționarea incidentelor ori pentru respectarea obligațiilor legale. Copiile din sistemele de backup sunt eliminate conform ciclului tehnic aplicabil."),
    ("3. Natura și scopul", "Operațiunile pot include colectarea, organizarea, stocarea, consultarea, transmiterea către furnizori autorizați, actualizarea, exportul și ștergerea datelor. Scopurile sunt gestionarea programărilor, clienților, serviciilor, comunicărilor, integrărilor, documentelor și funcțiilor de facturare contractate de Client."),
    ("4. Persoane vizate și categorii de date", "Persoanele vizate pot fi reprezentanții, angajații și colaboratorii Clientului, precum și clienții finali ai acestuia. Datele pot include nume, telefon, e-mail, rol profesional, detalii despre programări și servicii, conversații, documente încărcate, informații de facturare și identificatori tehnici. Clientul stabilește categoriile concrete și legalitatea prelucrării."),
    ("5. Instrucțiuni documentate", "BookEasy prelucrează datele numai potrivit instrucțiunilor documentate ale Clientului, inclusiv în privința transferurilor internaționale. Configurarea contului și utilizarea funcțiilor platformei constituie instrucțiuni documentate. Dacă legea impune o altă prelucrare, Clientul va fi informat în prealabil, în măsura permisă."),
    ("6. Confidențialitate", "Accesul este limitat la persoanele care au nevoie de date pentru îndeplinirea atribuțiilor și care sunt supuse unor obligații de confidențialitate. BookEasy asigură instruirea și controlul accesului personalului autorizat."),
    ("7. Securitatea prelucrării", "BookEasy aplică măsuri tehnice și organizatorice proporționale cu riscul, între care controlul accesului, autentificarea, conexiuni criptate, separarea logică a datelor, jurnalizare operațională, copii de siguranță și proceduri de răspuns la incidente. Clientul răspunde de administrarea utilizatorilor proprii, de parole și de dispozitivele folosite."),
    ("8. Subîmputerniciți", "Clientul acordă o autorizare generală pentru folosirea furnizorilor necesari găzduirii, bazei de date, stocării, e-mailului, autentificării, integrărilor și plăților. Lista categoriilor și furnizorilor actuali este indicată în Politica de confidențialitate de pe bookeasy.ro. BookEasy impune obligații de protecție echivalente și rămâne răspunzător pentru propriile obligații."),
    ("9. Transferuri internaționale", "Dacă datele sunt prelucrate în afara Spațiului Economic European, BookEasy utilizează un mecanism permis de GDPR, precum o decizie de adecvare sau Clauzele Contractuale Standard, împreună cu măsuri suplimentare când sunt necesare."),
    ("10. Drepturile persoanelor vizate", "Ținând cont de natura prelucrării, BookEasy asistă Clientul prin măsuri tehnice și informații rezonabile pentru soluționarea cererilor de acces, rectificare, ștergere, restricționare, portabilitate sau opoziție. Clientul rămâne punctul principal de contact și răspunde de evaluarea cererilor."),
    ("11. Încălcări ale securității", "BookEasy notifică fără întârzieri nejustificate Clientul după ce ia cunoștință de o încălcare a securității datelor personale și comunică informațiile disponibile necesare evaluării, limitării efectelor și îndeplinirii obligațiilor de notificare."),
    ("12. Asistență și audit", "La solicitare rezonabilă, BookEasy furnizează informațiile necesare demonstrării conformității și permite audituri proporționale, planificate în prealabil, fără afectarea securității, secretelor comerciale sau datelor altor clienți. Costurile extraordinare pot fi suportate de Client dacă auditul nu identifică o neconformitate materială."),
    ("13. Returnarea și ștergerea", "La încetarea serviciilor, Clientul poate solicita exportul disponibil și ștergerea datelor, cu excepția informațiilor a căror conservare este impusă de lege. Datele păstrate în backup rămân protejate, nu sunt folosite în alte scopuri și sunt șterse potrivit ciclului tehnic."),
    ("14. Răspundere și ordine de prioritate", "Răspunderea părților este guvernată de contract și de legislația aplicabilă. În caz de conflict privind prelucrarea datelor în numele Clientului, prezentul DPA prevalează față de Termenii și Condițiile generale."),
    ("15. Contact", "Solicitările privind acest acord se transmit la nextlevel.zalau@gmail.com. Operatorul platformei este NEXTLEVEL AUTOMATION S.R.L., CUI 55476878, J2026051349006, Str. Fundătura nr. 1A, sat Mirșid, com. Mirșid, jud. Sălaj, România."),
]

def page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(20 * mm, 16 * mm, 190 * mm, 16 * mm)
    canvas.setFont("BookEasy", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 10 * mm, "BookEasy · DPA v1.0 · 5 octombrie 2026")
    canvas.drawRightString(190 * mm, 10 * mm, f"Pagina {doc.page}")
    canvas.restoreState()

doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, rightMargin=20*mm, leftMargin=20*mm, topMargin=18*mm, bottomMargin=40*mm, title="DPA BookEasy v1.0", author="NEXTLEVEL AUTOMATION S.R.L.")
story = [Spacer(1, 23*mm), Paragraph("BOOKEASY · DOCUMENT CONTRACTUAL", styles["CoverTag"]), Paragraph("Acord de prelucrare<br/>a datelor cu caracter personal", styles["CoverTitle"]), Paragraph("DPA conform Art. 28 din Regulamentul (UE) 2016/679", styles["CoverBody"]), Spacer(1, 8*mm)]
parties = [[Paragraph("PERSOANĂ ÎMPUTERNICITĂ", styles["Smallx"]), Paragraph("OPERATOR", styles["Smallx"])], [Paragraph("<b>NEXTLEVEL AUTOMATION S.R.L.</b><br/>CUI 55476878 · J2026051349006<br/>Str. Fundătura nr. 1A, Mirșid, Sălaj<br/>nextlevel.zalau@gmail.com", styles["Bodyx"]), Paragraph("Clientul business identificat în contul BookEasy și în documentele de facturare aferente abonamentului.", styles["Bodyx"])]]
t = Table(parties, colWidths=[82*mm, 82*mm], hAlign="CENTER")
t.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), SOFT), ("BOX", (0,0), (-1,-1), .6, LINE), ("INNERGRID", (0,0), (-1,-1), .5, LINE), ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10), ("TOPPADDING", (0,0), (-1,-1), 9), ("BOTTOMPADDING", (0,0), (-1,-1), 9)]))
story += [t, Spacer(1, 10*mm), Paragraph("Versiunea 1.0 · aplicabilă din 5 octombrie 2026", styles["CoverBody"]), PageBreak(), Paragraph("Acord de prelucrare a datelor", styles["H1x"]), Paragraph("Prezentul acord este încheiat între Client, în calitate de operator, și NEXTLEVEL AUTOMATION S.R.L., furnizorul platformei BookEasy, în calitate de persoană împuternicită. Termenii GDPR au sensul stabilit de Regulamentul (UE) 2016/679.", styles["Bodyx"])]
for title, body in sections:
    story.append(KeepTogether([Paragraph(title, styles["H2x"]), Paragraph(body, styles["Bodyx"])]))
story += [PageBreak(), Paragraph("Semnături", styles["H1x"]), Paragraph("Prezentul DPA poate fi acceptat electronic prin activarea sau utilizarea serviciului BookEasy. Câmpurile de mai jos pot fi folosite dacă părțile aleg semnarea olografă sau electronică separată.", styles["Bodyx"]), Spacer(1, 8*mm), Table([[Paragraph("Pentru Client", styles["Bodyx"]), Paragraph("Pentru NEXTLEVEL AUTOMATION S.R.L.", styles["Bodyx"])], [Paragraph("Nume / funcție:<br/><br/>Data:<br/><br/>Semnătura:", styles["Bodyx"]), Paragraph("Reprezentant autorizat:<br/><br/>Data:<br/><br/>Semnătura:", styles["Bodyx"])]], colWidths=[82*mm,82*mm], style=[("BOX",(0,0),(-1,-1),.6,LINE),("INNERGRID",(0,0),(-1,-1),.5,LINE),("VALIGN",(0,0),(-1,-1),"TOP"),("BACKGROUND",(0,0),(-1,0),SOFT),("LEFTPADDING",(0,0),(-1,-1),10),("TOPPADDING",(0,0),(-1,-1),9),("BOTTOMPADDING",(0,1),(-1,-1),12)])]
doc.build(story, onFirstPage=page, onLaterPages=page)
PUBLIC.write_bytes(OUTPUT.read_bytes())
print(OUTPUT)
print(PUBLIC)
