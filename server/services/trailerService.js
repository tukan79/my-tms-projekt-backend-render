// Plik: server/services/manifestService.js
const PDFDocument = require('pdfkit');
const { Run, Driver, Truck, Trailer, Order, Assignment } = require('../models');

const generateRunManifestPDF = async (runId) => {
  // 1. Pobierz wszystkie dane jednym zapytaniem
  const run = await Run.findByPk(runId, {
    include: [
      { model: Driver, as: 'driver', attributes: ['firstName', 'lastName'] },
      { model: Truck, as: 'truck', attributes: ['registrationPlate'] },
      { model: Trailer, as: 'trailer', attributes: ['registrationPlate'] },
      {
        model: Assignment,
        as: 'assignments',
        attributes: ['createdAt'],
        include: [{
          model: Order,
          as: 'order',
          attributes: [
            'orderNumber',
            'customerReference',
            'senderDetails',
            'recipientDetails',
            'cargoDetails'
          ],
        }],
      },
    ],
    order: [
      [{ model: Assignment, as: 'assignments' }, 'createdAt', 'ASC']
    ],
  });

  if (!run) {
    throw new Error('Run not found');
  }

  // Wyodrębnij same zamówienia
  const orders = run.assignments.map(a => a.order);

  // 2. Generowanie PDF do bufora (bez zagnieżdżonych template literals)
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const buffers = [];

  doc.on('data', (chunk) => buffers.push(chunk));

  const pdfPromise = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
  });

  // --- Nagłówek ---
  doc
    .fontSize(20)
    .font('Helvetica-Bold')
    .text(`Run Manifest: #${run.id}`, { align: 'center' });

  doc.moveDown();
  doc.fontSize(12).font('Helvetica');

  const runDate = new Date(run.runDate).toLocaleDateString('pl-PL');
  const driverName = run.driver ? `${run.driver.firstName} ${run.driver.lastName}` : 'N/A';
  const vehicleReg = run.truck?.registrationPlate || 'N/A';
  const trailerReg = run.trailer?.registrationPlate || null;

  doc.text(`Date: ${runDate}`);
  doc.text(`Driver: ${driverName}`);
  doc.text(`Vehicle: ${vehicleReg}`);

  if (trailerReg) {
    doc.text(`Trailer: ${trailerReg}`);
  }

  doc.moveDown(2);

  // --- Tabela ---
  const tableTop = doc.y;
  const columnWidths = [100, 120, 120, 50, 50];
  const headers = ['Consignment #', 'Sender', 'Recipient', 'Pallets', 'Weight (kg)'];

  doc.font('Helvetica-Bold');

  headers.forEach((header, i) => {
    const x =
      50 +
      columnWidths
        .slice(0, i)
        .reduce((sum, w) => sum + w, 0);

    doc.text(header, x, tableTop);
  });

  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  // --- Wiersze tabeli ---
  doc.font('Helvetica');

  orders.forEach(order => {
    const rowY = doc.y;

    const totalPallets = (order.cargoDetails?.pallets || [])
      .reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);

    const totalKilos = order.cargoDetails?.total_kilos || 0;

    const rowData = [
      order.orderNumber || order.customerReference,
      order.senderDetails?.name || 'N/A',
      order.recipientDetails?.name || 'N/A',
      totalPallets,
      totalKilos
    ];

    rowData.forEach((cell, i) => {
      const x =
        50 +
        columnWidths
          .slice(0, i)
          .reduce((sum, w) => sum + w, 0);

      doc.text(String(cell), x, rowY, { width: columnWidths[i] - 10 });
    });

    doc.moveDown(1.5);
  });

  // --- Stopka ---
  const pageHeight = doc.page.height;
  const generatedAt = new Date().toLocaleString();

  doc
    .fontSize(8)
    .text(`Generated on: ${generatedAt}`, 50, pageHeight - 50);

  doc.end();

  return pdfPromise;
};

module.exports = {
  generateRunManifestPDF,
};
