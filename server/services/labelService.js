// Plik: server/services/labelService.js
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
const db = require('../db/index.js');

/**
 * Generuje PDF z etykietami paletowymi dla danego zlecenia.
 * @param {number} orderId - ID zlecenia.
 * @returns {Promise<Buffer>} Bufor z danymi PDF.
 */
const generatePalletLabelsPDF = async (orderId) => {
  const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (rows.length === 0) {
    throw new Error('Order not found');
  }
  const order = rows[0];

  const totalSpaces = order.cargo_details?.total_spaces || 1;
  const consignmentNumber = order.order_number || `ORD-${order.id}`;

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A6', // Standardowy rozmiar etykiety (105x148mm)
        margin: 20,
        autoFirstPage: false, // Ręcznie dodajemy strony w pętli
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      // Wygeneruj kod kreskowy jako bufor PNG
      const barcodeBuffer = await bwipjs.toBuffer({
        bcid: 'code128',       // Typ kodu kreskowego
        text: consignmentNumber, // Tekst do zakodowania
        scale: 3,              // Skala
        height: 15,            // Wysokość w mm
        includetext: true,     // Dołącz tekst pod kodem
        textxalign: 'center',  // Wyrównanie tekstu
      });

      for (let i = 1; i <= totalSpaces; i++) {
        doc.addPage();

        // Ramka etykiety
        doc.rect(15, 15, doc.page.width - 30, doc.page.height - 30).stroke();

        // --- Sekcja Odbiorcy (TO) ---
        doc.fontSize(10).font('Helvetica-Bold').text('TO:', 30, 30);
        doc.font('Helvetica').fontSize(12)
          .text(order.recipient_details?.name || 'N/A', 35, 45, { width: doc.page.width - 70 })
          .text(order.recipient_details?.address1 || '', { width: doc.page.width - 70 })
          .text(`${order.recipient_details?.postCode || ''} ${order.recipient_details?.city || ''}`, { width: doc.page.width - 70 });

        // Linia oddzielająca
        doc.moveTo(30, doc.y + 10).lineTo(doc.page.width - 30, doc.y + 10).stroke();

        // --- Sekcja Nadawcy (FROM) ---
        doc.fontSize(8).font('Helvetica-Bold').text('FROM:', 30, doc.y + 15);
        doc.font('Helvetica').fontSize(9)
          .text(order.sender_details?.name || 'N/A', 35, doc.y + 2, { width: doc.page.width - 70 });

        // --- Kod kreskowy i numer zlecenia ---
        const barcodeY = doc.page.height / 2 + 30;
        doc.image(barcodeBuffer, (doc.page.width - 150) / 2, barcodeY, { width: 150 });

        // --- Numer palety ---
        const palletNumberY = barcodeY + 60;
        doc.font('Helvetica-Bold').fontSize(24).text(`PALLET ${i} of ${totalSpaces}`, {
          align: 'center',
          y: palletNumberY,
        });

        // --- Stopka z numerem zlecenia i datą ---
        const footerY = doc.page.height - 40;
        doc.fontSize(9).font('Helvetica')
          .text(`Consignment: ${consignmentNumber}`, 30, footerY, { align: 'left' })
          .text(`Date: ${new Date(order.created_at).toLocaleDateString()}`, 30, footerY, { align: 'right' });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generatePalletLabelsPDF,
};