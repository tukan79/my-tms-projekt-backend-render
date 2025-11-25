// Plik: server/services/invoicePdfService.js
const PDFDocument = require('pdfkit');
const { Invoice, Customer, InvoiceItem, Order } = require('../models');

const generateInvoicePDF = async (invoiceId) => {
  // 1. Pobierz wszystkie dane za jednym zapytaniem używając modeli Sequelize i ich relacji
  const invoice = await Invoice.findByPk(invoiceId, {
    include: [
      {
        model: Customer,
        as: 'customer', // Alias zdefiniowany w modelu Invoice
        attributes: ['name', 'addressLine1', 'addressLine2', 'postcode', 'vatNumber'],
      },
      {
        model: InvoiceItem,
        as: 'items', // Alias zdefiniowany w modelu Invoice
        include: [{
          model: Order,
          as: 'order', // Alias zdefiniowany w modelu InvoiceItem
          attributes: ['orderNumber', 'customerReference', 'unloadingDateTime'],
        }],
      },
    ],
    order: [
      // Sortuj pozycje faktury na podstawie daty rozładunku zlecenia
      [{ model: InvoiceItem, as: 'items' }, { model: Order, as: 'order' }, 'unloadingDateTime', 'ASC']
    ],
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

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
    doc.font('Helvetica').text(invoice.customer.name, customerX, doc.y + 5);
    if (invoice.customer.addressLine1) doc.text(invoice.customer.addressLine1, customerX);
    if (invoice.customer.addressLine2) doc.text(invoice.customer.addressLine2, customerX);
    if (invoice.customer.postcode) doc.text(invoice.customer.postcode, customerX);
    if (invoice.customer.vatNumber) doc.font('Helvetica-Bold').text(`VAT: ${invoice.customer.vatNumber}`, customerX, doc.y + 5);

    doc.fontSize(10).font('Helvetica-Bold').text('Invoice Number:', invoiceX, startY);
    doc.font('Helvetica').text(invoice.invoiceNumber, invoiceX + 100);

    doc.font('Helvetica-Bold').text('Issue Date:', invoiceX, doc.y);
    doc.font('Helvetica').text(new Date(invoice.issueDate).toLocaleDateString(), invoiceX + 100);

    doc.font('Helvetica-Bold').text('Due Date:', invoiceX, doc.y);
    doc.font('Helvetica').text(new Date(invoice.dueDate).toLocaleDateString(), invoiceX + 100);

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
    invoice.items.forEach(item => {
      const y = doc.y;
      doc.text(item.order.orderNumber || 'N/A', itemX, y);
      doc.text(new Date(item.order.unloadingDateTime).toLocaleDateString(), dateX, y);
      doc.text(item.order.customerReference || 'N/A', refX, y);
      doc.text(`£${Number.parseFloat(item.amount).toFixed(2)}`, amountX, y, { align: 'right' });
      doc.moveDown();
    });

    // --- Podsumowanie ---
    const summaryY = doc.y + 20;
    doc.moveTo(300, summaryY - 10).lineTo(doc.page.width - 50, summaryY - 10).stroke();
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Total Amount:', 300, summaryY);
    doc.text(`£${parseFloat(invoice.totalAmount).toFixed(2)}`, 0, summaryY, { align: 'right' });

    // --- Stopka ---
    doc.fontSize(8).font('Helvetica').text('Thank you for your business!', 50, doc.page.height - 50, {
      align: 'center',
      lineBreak: false,
    });

    doc.end();
  });
};

module.exports = {
  generateInvoicePDF,
};