// Plik: server/services/labelService.js
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
const { Order } = require('../models');
const logger = require('../config/logger');

// --- Stałe i Konfiguracja ---
const FONT_REGULAR = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('pl-PL');
};

/**
 * Helper – generuje bufor z kodem kreskowym
 */
const generateBarcode = (text) => {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 3,
    height: 15,
    includetext: true,
    textxalign: 'center',
  });
};

/**
 * Helper – zapisuje PDFDocument do bufora
 */
const streamPdfToBuffer = (doc) => {
  return new Promise((resolve, reject) => { // eslint-disable-line no-async-promise-executor
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => {
      logger.error('Error during PDF stream processing.', { error: err.message });
      reject(err);
    });

    doc.end();
  });
};

/**
 * Generuje PDF z etykietami paletowymi dla danego zlecenia.
 * @param {number} orderId
 * @returns {Promise<Buffer>}
 */
const generatePalletLabelsPDF = async (orderId) => {
  logger.info(`Generating pallet labels for order ID: ${orderId}`);
  try {
    const order = await Order.findByPk(orderId);
    if (!order) {
      logger.warn(`Order with ID ${orderId} not found for label generation.`);
      throw new Error(`Order with ID ${orderId} not found`);
    }

    const totalSpaces = order.cargoDetails?.total_spaces || 1;
    const consignmentNumber = order.orderNumber || `ORD-${order.id}`;

    const doc = new PDFDocument({
      size: 'A6',
      margin: 20,
      autoFirstPage: false,
    });

    const barcodeBuffer = await generateBarcode(consignmentNumber);

    for (let i = 1; i <= totalSpaces; i++) {
      doc.addPage();

      // Ramka
      doc.rect(15, 15, doc.page.width - 30, doc.page.height - 30).stroke();

      // TO section
      doc.font(FONT_BOLD).fontSize(10).text('TO:', 30, 30);
      doc
        .font(FONT_REGULAR)
        .fontSize(12)
        .text(order.recipientDetails?.name || 'N/A', 35, 45, { width: doc.page.width - 70 })
        .text(order.recipientDetails?.address1 || '', { width: doc.page.width - 70 })
        .text(
          `${order.recipientDetails?.postCode || ''} ${order.recipientDetails?.city || ''}`,
          { width: doc.page.width - 70 }
        );

      doc.moveTo(30, doc.y + 10).lineTo(doc.page.width - 30, doc.y + 10).stroke();

      // FROM section
      doc.font(FONT_BOLD).fontSize(8).text('FROM:', 30, doc.y + 15);
      doc
        .font(FONT_REGULAR)
        .fontSize(9)
        .text(order.senderDetails?.name || 'N/A', 35, doc.y + 2, { width: doc.page.width - 70 });

      // Barcode
      const barcodeY = doc.page.height / 2 + 30;
      doc.image(barcodeBuffer, (doc.page.width - 150) / 2, barcodeY, { width: 150 });

      // Pallet number
      const palletNumberY = barcodeY + 60;
      doc.font(FONT_BOLD).fontSize(24).text(`PALLET ${i} of ${totalSpaces}`, {
        align: 'center',
        y: palletNumberY,
      });

      // Footer
      const footerY = doc.page.height - 40;
      doc
        .font(FONT_REGULAR)
        .fontSize(9)
        .text(`Consignment: ${consignmentNumber}`, 30, footerY)
        .text(`Date: ${formatDate(order.createdAt)}`, 0, footerY, { align: 'right' });
    }

    return streamPdfToBuffer(doc);
  } catch (error) {
    logger.error(`Failed to generate pallet labels for order ID ${orderId}.`, { error: error.message });
    throw error;
  }
};

module.exports = {
  generatePalletLabelsPDF,
};
