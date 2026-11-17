"""
polish_docx.py
==============
Applies academic styling standards to the generated DietShift Atlas DOCX paper:
- Margins: Standard 1 inch (25.4 mm) on all sides.
- Typography: Professional academic styling (Calibri / Georgia hierarchy).
- Table Styling: Publication-grade styling (header row shading, padding, borders).
- Headers & Footers: Running title in header, page numbers in footer.
"""

import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

DOCX_PATH = "paper/DietShift_Atlas_Academic_Paper.docx"

def polish():
    if not os.path.exists(DOCX_PATH):
        print(f"File {DOCX_PATH} does not exist.")
        return

    doc = Document(DOCX_PATH)

    # 1. Page Margins (1 inch / 72 pt)
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

        # Header: Running Title
        header = section.header
        hp = header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hp.text = "DietShift Atlas: A Privacy-Preserving Food Systems Observatory"
        for r in hp.runs:
            r.font.name = "Calibri"
            r.font.size = Pt(8.5)
            r.font.color.rgb = RGBColor(120, 130, 140)

        # Footer: Author & License
        footer = section.footer
        fp = footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        fp.text = "Amine Zouaghi — FutureData4EU / MSCA Horizon Europe — Open Access"
        for r in fp.runs:
            r.font.name = "Calibri"
            r.font.size = Pt(8.5)
            r.font.color.rgb = RGBColor(140, 145, 150)

    # 2. Paragraph Formatting
    brand_teal = RGBColor(22, 61, 74)      # #163d4a
    brand_berry = RGBColor(138, 18, 83)    # #8a1253
    charcoal = RGBColor(40, 45, 50)

    for p in doc.paragraphs:
        style_name = p.style.name if p.style else ""
        
        # Title
        if style_name == "Title":
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(10)
            for r in p.runs:
                r.font.name = "Georgia"
                r.font.size = Pt(18)
                r.font.bold = True
                r.font.color.rgb = brand_teal

        # Heading 1
        elif style_name == "Heading 1":
            p.paragraph_format.space_before = Pt(14)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.keep_with_next = True
            for r in p.runs:
                r.font.name = "Georgia"
                r.font.size = Pt(13)
                r.font.bold = True
                r.font.color.rgb = brand_teal

        # Heading 2
        elif style_name == "Heading 2":
            p.paragraph_format.space_before = Pt(10)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.keep_with_next = True
            for r in p.runs:
                r.font.name = "Georgia"
                r.font.size = Pt(11.5)
                r.font.bold = True
                r.font.color.rgb = brand_berry

        # Heading 3
        elif style_name == "Heading 3":
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.keep_with_next = True
            for r in p.runs:
                r.font.name = "Calibri"
                r.font.size = Pt(10.5)
                r.font.bold = True
                r.font.color.rgb = brand_teal

        # Body text / Normal
        elif style_name in ["Normal", "Body Text"]:
            p.paragraph_format.line_spacing = 1.15
            p.paragraph_format.space_after = Pt(4)
            for r in p.runs:
                if not r.font.name:
                    r.font.name = "Calibri"
                if not r.font.size:
                    r.font.size = Pt(10.5)
                r.font.color.rgb = charcoal

    # 3. Table Styling
    def set_cell_background(cell, fill_hex):
        shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
        cell._tc.get_or_add_tcPr().append(shading)

    def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
        tcPr = cell._tc.get_or_add_tcPr()
        tcMar = parse_xml(f'''
            <w:tcMar {nsdecls("w")}>
                <w:top w:w="{top}" w:type="dxa"/>
                <w:bottom w:w="{bottom}" w:type="dxa"/>
                <w:left w:w="{left}" w:type="dxa"/>
                <w:right w:w="{right}" w:type="dxa"/>
            </w:tcMar>
        ''')
        tcPr.append(tcMar)

    for table in doc.tables:
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        
        # Style rows
        for row_idx, row in enumerate(table.rows):
            is_header = (row_idx == 0)
            bg_color = "163D4A" if is_header else ("F8FAFC" if row_idx % 2 == 1 else "FFFFFF")
            
            for cell in row.cells:
                set_cell_background(cell, bg_color)
                set_cell_margins(cell, top=120, bottom=120, left=140, right=140)
                
                for p in cell.paragraphs:
                    p.paragraph_format.space_before = Pt(1)
                    p.paragraph_format.space_after = Pt(1)
                    for r in p.runs:
                        r.font.name = "Calibri"
                        r.font.size = Pt(9.5 if is_header else 9)
                        if is_header:
                            r.font.bold = True
                            r.font.color.rgb = RGBColor(255, 255, 255)
                        else:
                            r.font.color.rgb = charcoal

    output_path = "paper/DietShift_Atlas_Academic_Paper.docx"
    doc.save(output_path)
    print(f"Successfully polished and saved academic DOCX to: {output_path}")

if __name__ == "__main__":
    polish()
