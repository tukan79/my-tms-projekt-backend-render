// Plik: server/services/invoicePdfService.js
const PDFDocument = require('pdfkit');
const { Invoice, Customer, InvoiceItem, Order } = require('../models');
const logger = require('../config/logger'); // Załóżmy, że masz logger

// --- Stałe i Konfiguracja ---
const FONT_REGULAR = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  // Użycie toLocaleDateString jest OK, ale dla spójności można rozważyć bibliotekę jak date-fns
  return new Date(dateString).toLocaleDateString('pl-PL'); // Przykładowo: 'pl-PL'
};

const generateInvoicePDF = async (invoiceId) => {
  logger.info(`Generating PDF for invoice ID: ${invoiceId}`);

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
    logger.warn(`Invoice with ID ${invoiceId} not found.`);
    throw new Error(`Invoice with ID ${invoiceId} not found`);
  }

  // 2. Stwórz dokument PDF
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => {
      logger.error(`Error generating PDF for invoice ID ${invoiceId}:`, err);
      reject(err);
    });

    // --- Nagłówek ---
    doc.fontSize(20).font(FONT_BOLD).text('INVOICE', { align: 'center' });
    doc.moveDown();

    // --- Dane firmy i faktury ---
    const customerX = 320;
    const invoiceX = 50;
    const startY = doc.y;

    doc.fontSize(10).font(FONT_BOLD).text('Bill To:', customerX, startY);
    doc.font(FONT_REGULAR).text(invoice.customer.name, customerX, doc.y + 5);
    if (invoice.customer.addressLine1) doc.text(invoice.customer.addressLine1, customerX);
    if (invoice.customer.addressLine2) doc.text(invoice.customer.addressLine2, customerX);
    if (invoice.customer.postcode) doc.text(invoice.customer.postcode, customerX);
    if (invoice.customer.vatNumber) doc.font(FONT_BOLD).text(`VAT: ${invoice.customer.vatNumber}`, customerX, doc.y + 5);

    doc.fontSize(10).font(FONT_BOLD).text('Invoice Number:', invoiceX, startY);
    doc.font(FONT_REGULAR).text(invoice.invoiceNumber, invoiceX + 100);

    doc.font(FONT_BOLD).text('Issue Date:', invoiceX, doc.y);
    doc.font(FONT_REGULAR).text(formatDate(invoice.issueDate), invoiceX + 100);

    doc.font(FONT_BOLD).text('Due Date:', invoiceX, doc.y);
    doc.font(FONT_REGULAR).text(formatDate(invoice.dueDate), invoiceX + 100);

    doc.moveDown(3);

    // --- Tabela z pozycjami ---
    const tableTop = doc.y;
    const itemX = 50;
    const dateX = 150;
    const refX = 300;
    const amountX = 480;

    doc.fontSize(10).font(FONT_BOLD);
    doc.text('Consignment #', itemX, tableTop);
    doc.text('Delivery Date', dateX, tableTop);
    doc.text('Customer Ref', refX, tableTop);
    doc.text('Amount', amountX, tableTop, { align: 'right' });
    doc.moveTo(itemX, doc.y).lineTo(doc.page.width - itemX, doc.y).stroke();
    doc.moveDown();

    doc.font(FONT_REGULAR).fontSize(9);
    invoice.items.forEach(item => {
      const y = doc.y;
      doc.text(item.order.orderNumber || 'N/A', itemX, y);
      doc.text(formatDate(item.order.unloadingDateTime), dateX, y);
      doc.text(item.order.customerReference || 'N/A', refX, y);
      doc.text(`£${Number(item.amount).toFixed(2)}`, amountX, y, { align: 'right' });
      doc.moveDown();
    });

    // --- Podsumowanie ---
    const summaryY = doc.y + 20;
    doc.moveTo(300, summaryY - 10).lineTo(doc.page.width - 50, summaryY - 10).stroke();
    doc.font(FONT_BOLD).fontSize(12);
    doc.text('Total Amount:', 300, summaryY);
    doc.text(`£${Number(invoice.totalAmount).toFixed(2)}`, 0, summaryY, { align: 'right' });

    // --- Stopka ---
    doc.fontSize(8).font(FONT_REGULAR).text('Thank you for your business!', 50, doc.page.height - 50, {
      align: 'center',
      lineBreak: false,
    });

    doc.end();
  });
};

module.exports = {
  generateInvoicePDF,
};