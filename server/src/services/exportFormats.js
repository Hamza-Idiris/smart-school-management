import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export function sendCsv(res, filename, headers, rows) {
  const escape = (value) => {
    const str = value == null ? '' : String(value);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const lines = [
    headers.map((h) => escape(h.label)).join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h.key])).join(',')),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.send(lines.join('\n'));
}

export async function sendXlsx(res, filename, sheetName, headers, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName || 'Report');
  sheet.addRow(headers.map((h) => h.label));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(headers.map((h) => row[h.key] ?? ''));
  }
  headers.forEach((_, idx) => {
    sheet.getColumn(idx + 1).width = 18;
  });
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

export function sendPdfTable(res, filename, title, headers, rows, metaLines = []) {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: rows[0] && headers.length > 6 ? 'landscape' : 'portrait' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);

  doc.fontSize(16).text(title, { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(9).fillColor('#555');
  for (const line of metaLines) doc.text(line);
  doc.fillColor('#000');
  doc.moveDown(0.6);

  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = usableWidth / headers.length;
  const startX = doc.page.margins.left;

  const drawHeader = () => {
    let x = startX;
    const y = doc.y;
    doc.fontSize(8).font('Helvetica-Bold');
    for (const h of headers) {
      doc.text(h.label, x, y, { width: colWidth - 4, continued: false });
      x += colWidth;
    }
    doc.moveDown(0.8);
    doc.moveTo(startX, doc.y).lineTo(startX + usableWidth, doc.y).stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica');
  };

  drawHeader();

  for (const row of rows) {
    if (doc.y > doc.page.height - 50) {
      doc.addPage();
      drawHeader();
    }
    let x = startX;
    const y = doc.y;
    let maxH = 12;
    for (const h of headers) {
      const text = row[h.key] == null ? '' : String(row[h.key]);
      const hgt = doc.heightOfString(text, { width: colWidth - 4 });
      maxH = Math.max(maxH, hgt);
      doc.text(text, x, y, { width: colWidth - 4 });
      x += colWidth;
    }
    doc.y = y + maxH + 4;
  }

  doc.end();
}

export async function sendExport(res, { format, filename, title, headers, rows, metaLines }) {
  const fmt = String(format || 'csv').toLowerCase();
  if (fmt === 'xlsx') {
    await sendXlsx(res, filename, title, headers, rows);
    return;
  }
  if (fmt === 'pdf') {
    sendPdfTable(res, filename, title, headers, rows, metaLines);
    return;
  }
  sendCsv(res, filename, headers, rows);
}
