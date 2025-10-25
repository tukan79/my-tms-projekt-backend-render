// Plik: server/services/invoicePdfService.js
const PDFDocument = require('pdfkit');
const db = require('../db/index.js');

const generateInvoicePDF = async (invoiceId) => {
  // 1. Pobierz dane faktury, klienta i pozycji faktury
  const invoiceQuery = `
    SELECT i.*, c.name as customer_name, c.address_line1, c.address_line2, c.postcode, c.vat_number
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.id = $1
  `;
  const invoiceRes = await db.query(invoiceQuery, [invoiceId]);
  if (invoiceRes.rows.length === 0) {
    throw new Error('Invoice not found');
  }
  const invoice = invoiceRes.rows[0];

  const itemsQuery = `
    SELECT o.order_number, o.customer_reference, o.unloading_date_time, ii.amount
    FROM invoice_items ii
    JOIN orders o ON ii.order_id = o.id
    WHERE ii.invoice_id = $1
    ORDER BY o.unloading_date_time
  `;
  const itemsRes = await db.query(itemsQuery, [invoiceId]);
  const items = itemsRes.rows;

  // 2. Stwórz dokument PDF
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // --- Nagłówek ---
    doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
    doc.moveDown();

    // --- Dane firmy i faktury ---
    const customerX = 320;
    const invoiceX = 50;
    const startY = doc.y;

    doc.fontSize(10).font('Helvetica-Bold').text('Bill To:', customerX, startY);
    doc.font('Helvetica').text(invoice.customer_name, customerX, doc.y + 5);
    if (invoice.address_line1) doc.text(invoice.address_line1, customerX);
    if (invoice.address_line2) doc.text(invoice.address_line2, customerX);
    if (invoice.postcode) doc.text(invoice.postcode, customerX);
    if (invoice.vat_number) doc.font('Helvetica-Bold').text(`VAT: ${invoice.vat_number}`, customerX, doc.y + 5);

    doc.fontSize(10).font('Helvetica-Bold').text('Invoice Number:', invoiceX, startY);
    doc.font('Helvetica').text(invoice.invoice_number, invoiceX + 100);

    doc.font('Helvetica-Bold').text('Issue Date:', invoiceX, doc.y);
    doc.font('Helvetica').text(new Date(invoice.issue_date).toLocaleDateString(), invoiceX + 100);

    doc.font('Helvetica-Bold').text('Due Date:', invoiceX, doc.y);
    doc.font('Helvetica').text(new Date(invoice.due_date).toLocaleDateString(), invoiceX + 100);

    doc.moveDown(3);

    // --- Tabela z pozycjami ---
    const tableTop = doc.y;
    const itemX = 50;
    const dateX = 150;
    const refX = 300;
    const amountX = 480;

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Consignment #', itemX, tableTop);
    doc.text('Delivery Date', dateX, tableTop);
    doc.text('Customer Ref', refX, tableTop);
    doc.text('Amount', amountX, tableTop, { align: 'right' });
    doc.moveTo(itemX, doc.y).lineTo(doc.page.width - itemX, doc.y).stroke();
    doc.moveDown();

    doc.font('Helvetica').fontSize(9);
    items.forEach(item => {
      const y = doc.y;
      doc.text(item.order_number || 'N/A', itemX, y);
      doc.text(new Date(item.unloading_date_time).toLocaleDateString(), dateX, y);
      doc.text(item.customer_reference || 'N/A', refX, y);
      doc.text(`£${parseFloat(item.amount).toFixed(2)}`, amountX, y, { align: 'right' });
      doc.moveDown();
    });

    // --- Podsumowanie ---
    const summaryY = doc.y + 20;
    doc.moveTo(300, summaryY - 10).lineTo(doc.page.width - 50, summaryY - 10).stroke();
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Total Amount:', 300, summaryY);
    doc.text(`£${parseFloat(invoice.total_amount).toFixed(2)}`, 0, summaryY, { align: 'right' });

    // --- Stopka ---
    doc.fontSize(8).font('Helvetica').text('Thank you for your business!', 50, doc.page.height - 50, {
      align: 'center',
      lineBreak: false,
    });

    doc.end();
  });
};

module.exports = { generateInvoicePDF };