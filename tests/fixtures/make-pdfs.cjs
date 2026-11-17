// Writes the small PDF fixtures used by tests/resume.test.cjs. Run: node tests/fixtures/make-pdfs.cjs
// The PDFs are hand-built (no PDF library) so the bytes are easy to audit: one text-based résumé and one
// image-only page that stands in for a scanned résumé.
const fs = require('node:fs'), path = require('node:path');
function build(objects) {
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'; const offsets = [];
  objects.forEach((body, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
const stream = (dict, data) => `<< ${dict} /Length ${Buffer.byteLength(data, 'latin1')} >>\nstream\n${data}\nendstream`;
const pdfText = s => s.replace(/[\\()]/g, c => '\\' + c);
// Lines as [x, y, size, text]; \x95 is the WinAnsi bullet.
function textPage(lines) { return 'BT\n' + lines.map(([x, y, size, t]) => `/F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfText(t)}) Tj`).join('\n') + '\nET'; }
const page1 = [
  [72, 760, 16, 'Asha Verma'], [72, 742, 10, 'Pune · asha.verma@example.com'],
  [72, 712, 12, 'EXPERIENCE'], [72, 696, 10, 'Analytics Intern, Northwind Retail (May 2025 - Jul 2025)'],
  [72, 682, 10, '\x95 Built a weekly sales dashboard in Power BI used by 12 store managers'],
  [72, 668, 10, '\x95 Responsible for cleaning data for the merchandising team and preparing re-'],
  [84, 654, 10, 'ports every Friday'],
  [72, 640, 10, '\x95 Reduced stock-outs by 18% by forecasting demand with Python'],
  [72, 610, 12, 'EDUCATION'], [72, 594, 10, 'B.Com, Example College, 2026']
];
const page2 = [[72, 760, 12, 'SKILLS'], [72, 744, 10, 'SQL, Excel, Python, Power BI, Tableau']];
const font = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
const text = build([
  '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>', stream('', textPage(page1)),
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>', stream('', textPage(page2)), font
]);
// A grey 16×16 image stretched over the page and no text at all, like a scan without OCR.
const pixels = Buffer.alloc(256, 0).map((_, i) => (i * 37) % 256).toString('latin1');
const scanned = build([
  '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>',
  stream('', 'q 468 0 0 648 72 72 cm /Im1 Do Q'), stream('/Type /XObject /Subtype /Image /Width 16 /Height 16 /ColorSpace /DeviceGray /BitsPerComponent 8', pixels)
]);
fs.writeFileSync(path.join(__dirname, 'resume-text.pdf'), text);
fs.writeFileSync(path.join(__dirname, 'resume-scanned.pdf'), scanned);
console.log('Wrote resume-text.pdf and resume-scanned.pdf');
