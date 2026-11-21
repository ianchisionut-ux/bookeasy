import json
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "lib" / "dpa-public.json"
PUBLIC = ROOT / "public" / "legal" / "dpa-bookeasy.pdf"
document = json.loads(SOURCE.read_text(encoding="utf-8"))
version = document["version"]
updated_at = document["updatedAt"]

font_dir = Path("C:/Windows/Fonts")
pdfmetrics.registerFont(TTFont("BookEasy", str(font_dir / "arial.ttf")))
pdfmetrics.registerFont(TTFont("BookEasyBold", str(font_dir / "arialbd.ttf")))

ink = colors.HexColor("#263B3F")
teal = colors.HexColor("#147F83")
muted = colors.HexColor("#536569")
line = colors.HexColor("#D9E6E4")
title_style = ParagraphStyle("Title", fontName="BookEasyBold", fontSize=24, leading=29, textColor=ink, spaceAfter=10)
heading_style = ParagraphStyle("Heading", fontName="BookEasyBold", fontSize=12, leading=16, textColor=teal, spaceBefore=9, spaceAfter=4)
notice_style = ParagraphStyle("Notice", fontName="BookEasy", fontSize=10, leading=15, textColor=muted, spaceAfter=8)
body_style = ParagraphStyle("Body", fontName="BookEasy", fontSize=10, leading=14.5, textColor=ink, spaceAfter=6)


def draw_footer(canvas, pdf):
    canvas.saveState()
    canvas.setStrokeColor(line)
    canvas.line(20 * mm, 16 * mm, 190 * mm, 16 * mm)
    canvas.setFont("BookEasy", 8)
    canvas.setFillColor(muted)
    canvas.drawString(20 * mm, 10 * mm, f"BookEasy | Model DPA {version} | {updated_at}")
    canvas.drawRightString(190 * mm, 10 * mm, f"Pagina {pdf.page}")
    canvas.restoreState()


story = [
    Paragraph("BOOKEASY · MODEL PUBLIC INFORMATIV", heading_style),
    Paragraph("Acord de prelucrare a datelor", title_style),
    Paragraph(f"Articolul 28 GDPR | Versiunea {version} | {updated_at}", notice_style),
    Paragraph("NEXTLEVEL AUTOMATION S.R.L. · CUI 55476878 · J2026051349006 · Str. Fundătura nr. 1A, sat Mirșid, com. Mirșid, jud. Sălaj, România", notice_style),
    Paragraph(escape(document["notice"]), body_style),
    Spacer(1, 2 * mm),
]
for section in document["sections"]:
    paragraphs = [Paragraph(escape(text), body_style) for text in section["paragraphs"]]
    story.append(KeepTogether([Paragraph(escape(section["heading"]), heading_style), *paragraphs]))

pdf = SimpleDocTemplate(
    str(PUBLIC), pagesize=A4, rightMargin=20 * mm, leftMargin=20 * mm,
    topMargin=16 * mm, bottomMargin=22 * mm, title=f"BookEasy - model DPA {version}",
    author="NEXTLEVEL AUTOMATION S.R.L.",
)
pdf.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
print(PUBLIC)
