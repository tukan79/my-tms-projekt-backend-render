// Plik: server/services/manifestService.js
const PDFDocument = require('pdfkit');
const { Run, Driver, Truck, Trailer, Order, Assignment } = require('../models');

// Helper – zapis PDF do bufora
const streamPdfToBuffer = (doc) => {
  return new Promise((resolve, reject) => {
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.end();
  });
};

const generateRunManifestPDF = async (runId) => {
  // Pobranie przejazdu z powiązanymi danymi
  const run = await Run.findByPk(runId, {
    include: [
      { model: Driver, as: 'driver', attributes: ['firstName', 'lastName'] },
      { model: Truck, as: 'truck', attributes: ['registrationPlate'] },
      { model: Trailer, as: 'trailer', attributes: ['registrationPlate'] },
      {
        model: Assignment,
        as: 'assignments',
        attributes: ['createdAt'],
        include: [
          {
            model: Order,
            as: 'order',
            attributes: [
              'orderNumber',
              'customerReference',
              'senderDetails',
              'recipientDetails',
              'cargoDetails',
            ],
          },
        ],
      },
    ],
    order: [[{ model: Assignment, as: 'assignments' }, 'createdAt', 'ASC']],
  });

  if (!run) {
    throw new Error('Run not found');
  }

  const orders = run.assignments.map((a) => a.order);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // Header
  doc
    .fontSize(20)
    .font('Helvetica-Bold')
    .text(`Run Manifest: #${run.id}`, { align: 'center' });

  doc.moveDown();
  doc.fontSize(12).font('Helvetica');

  const driverName = run.driver
    ? `${run.driver.firstName} ${run.driver.lastName}`
    : 'N/A';

  doc.text(`Date: ${new Date(run.runDate).toLocaleDateString('pl-PL')}`);
  doc.text(`Driver: ${driverName}`);
  doc.text(`Vehicle: ${run.truck?.registrationPlate || 'N/A'}`);

  if (run.trailer?.registrationPlate) {
    doc.text(`Trailer: ${run.trailer.registrationPlate}`);
  }

  doc.moveDown(2);

  // Table header
  const tableTop = doc.y;
  const columnWidths = [100, 120, 120, 50, 50];
  const headers = ['Consignment #', 'Sender', 'Recipient', 'Pallets', 'Weight (kg)'];

  doc.font('Helvetica-Bold');
  headers.forEach((header, i) => {
    const x = 50 + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.text(header, x, tableTop);
  });

  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  // Rows
  doc.font('Helvetica');

  orders.forEach((order) => {
    const rowY = doc.y;
    const totalPallets = (order.cargoDetails?.pallets || []).reduce(
      (sum, p) => sum + (Number(p.quantity) || 0),
      0
    );
    const totalKilos = order.cargoDetails?.total_kilos || 0;

    const positions = [
      50,
      50 + columnWidths[0],
      50 + columnWidths[0] + columnWidths[1],
      50 + columnWidths.slice(0, 3).reduce((a, b) => a + b, 0),
      50 + columnWidths.slice(0, 4).reduce((a, b) => a + b, 0),
    ];

    doc.text(order.orderNumber || order.customerReference, positions[0], rowY, {
      width: columnWidths[0] - 10,
    });
    doc.text(order.senderDetails?.name || 'N/A', positions[1], rowY, {
      width: columnWidths[1] - 10,
    });
    doc.text(order.recipientDetails?.name || 'N/A', positions[2], rowY, {
      width: columnWidths[2] - 10,
    });
    doc.text(totalPallets, positions[3], rowY, {
      width: columnWidths[3] - 10,
    });
    doc.text(totalKilos, positions[4], rowY, {
      width: columnWidths[4] - 10,
    });

    doc.moveDown(1.5);
  });

  // Footer
  const pageHeight = doc.page.height;
  doc.fontSize(8).text(`Generated on: ${new Date().toLocaleString()}`, 50, pageHeight - 50);

  return streamPdfToBuffer(doc);
};

module.exports = {
  generateRunManifestPDF,
};
