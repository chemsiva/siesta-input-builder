#!/bin/bash
set -e

DOCS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEX_FILE="${DOCS_DIR}/siesta_universal_guide.tex"
HTML_FILE="${DOCS_DIR}/siesta_universal_guide.html"
RAW_PDF="${DOCS_DIR}/siesta_universal_guide_raw.pdf"
FINAL_PDF="${DOCS_DIR}/SIESTA_Universal_Guide.pdf"
CSS_FILE="${DOCS_DIR}/guide_style.css"

cat << 'STYLE' > "${CSS_FILE}"
@page {
  size: A4;
  margin: 18mm 16mm 20mm 16mm;
  @bottom-right {
    content: counter(page);
    font-size: 8.5pt;
    color: #64748b;
    font-family: sans-serif;
  }
}
body {
  font-family: "Liberation Serif", "Times New Roman", Times, serif;
  font-size: 10.5pt;
  line-height: 1.5;
  color: #0f172a;
  max-width: 100%;
  margin: 0;
  padding: 0;
}
h1, h2, h3, h4 {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #0f172a;
  page-break-after: avoid;
}
h1 {
  font-size: 18pt;
  border-bottom: 2px solid #1e40af;
  padding-bottom: 4px;
  margin-top: 22pt;
  margin-bottom: 8pt;
  color: #0f172a;
}
h2 {
  font-size: 13.5pt;
  border-bottom: 1px solid #cbd5e1;
  padding-bottom: 2px;
  margin-top: 16pt;
  margin-bottom: 6pt;
  color: #1e40af;
}
h3 {
  font-size: 11pt;
  margin-top: 12pt;
  margin-bottom: 4pt;
  color: #0369a1;
}
p {
  margin-top: 0;
  margin-bottom: 8pt;
  text-align: justify;
}
ul, ol {
  margin-top: 0;
  margin-bottom: 8pt;
  padding-left: 20px;
}
li {
  margin-bottom: 3pt;
}
table {
  border-collapse: collapse;
  width: 100%;
  margin: 10pt 0 14pt;
  font-size: 8.8pt;
  page-break-inside: avoid;
}
th, td {
  padding: 5px 8px;
  border-top: 1px solid #cbd5e1;
  border-bottom: 1px solid #cbd5e1;
}
th {
  background-color: #f1f5f9;
  border-top: 2px solid #0f172a;
  border-bottom: 1.5px solid #0f172a;
  font-weight: 700;
  color: #0f172a;
}
pre {
  background-color: #f8fafc;
  border: 1px solid #cbd5e1;
  border-left: 3px solid #2563eb;
  border-radius: 4px;
  padding: 7px 10px;
  font-family: "DejaVu Sans Mono", "Fira Code", monospace;
  font-size: 8.2pt;
  line-height: 1.4;
  overflow-x: auto;
  page-break-inside: avoid;
  margin: 6pt 0 10pt;
}
code {
  font-family: "DejaVu Sans Mono", "Fira Code", monospace;
  font-size: 8.5pt;
  background-color: #f1f5f9;
  padding: 1px 4px;
  border-radius: 3px;
  color: #0284c7;
}
math {
  font-size: 10.5pt;
}
nav#TOC {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 12px 18px;
  margin-bottom: 20pt;
  page-break-after: always;
}
nav#TOC ul {
  list-style-type: none;
  padding-left: 15px;
}
nav#TOC > ul {
  padding-left: 0;
}
nav#TOC a {
  text-decoration: none;
  color: #1e40af;
  font-size: 9.5pt;
}
nav#TOC a:hover {
  text-decoration: underline;
}
figure {
  margin: 14pt auto 16pt;
  text-align: center;
  page-break-inside: avoid;
}
figure img {
  max-width: 95%;
  height: auto;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
  display: block;
  margin: 0 auto 6pt;
}
figcaption {
  font-size: 8.8pt;
  color: #475569;
  font-style: italic;
  line-height: 1.35;
  padding: 0 10px;
}
STYLE

echo "Step 1: Converting LaTeX to MathML HTML with Pandoc..."
pandoc "${TEX_FILE}" -o "${HTML_FILE}" -s --mathml --css="guide_style.css" --toc --toc-depth=2

echo "Step 2: Rendering HTML to PDF via Headless Chrome..."
google-chrome --headless=new --disable-gpu --no-sandbox --no-pdf-header-footer \
  --print-to-pdf="${RAW_PDF}" "file://${HTML_FILE}"
echo "Step 3: Compressing & Optimizing PDF via Ghostscript..."
gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook \
   -dNOPAUSE -dQUIET -dBATCH \
   -sOutputFile="${FINAL_PDF}" "${RAW_PDF}"

rm -f "${RAW_PDF}"
echo "✓ Done! Output generated: ${FINAL_PDF}"
ls -lh "${FINAL_PDF}"
