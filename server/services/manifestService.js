// Plik: server/services/manifestService.js
const PDFDocument = require('pdfkit');
const { Run, Driver, Truck, Trailer, Order, Assignment } = require('../models');

const generateRunManifestPDF = async (runId) => {
  // 1. Pobierz wszystkie dane za jednym zapytaniem używając modeli Sequelize i ich relacji
  const run = await Run.findByPk(runId, {
    include: [
      { model: Driver, as: 'driver', attributes: ['firstName', 'lastName'] },
      { model: Truck, as: 'truck', attributes: ['registrationPlate'] },
      { model: Trailer, as: 'trailer', attributes: ['registrationPlate'] },
      {
        model: Assignment,
        as: 'assignments',
        attributes: ['createdAt'], // Potrzebne tylko do sortowania
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
      // Sortuj zlecenia na podstawie daty ich przypisania do przejazdu
      [{ model: Assignment, as: 'assignments' }, 'createdAt', 'ASC']
    ],
  });

  if (!run) {
    throw new Error('Run not found');
  }
  // Wyodrębniamy same zlecenia z obiektów przypisań
  const orders = run.assignments.map(assignment => assignment.order);

  // 2. Stwórz dokument PDF w pamięci
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });
    doc.on('error', reject);

    // --- Nagłówek ---
    doc.fontSize(20).font('Helvetica-Bold').text(`Run Manifest: #${run.id}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica');
    doc.text(`Date: ${new Date(run.runDate).toLocaleDateString('pl-PL')}`);
    doc.text(`Driver: ${run.driver ? `${run.driver.firstName} ${run.driver.lastName}` : 'N/A'}`);
    doc.text(`Vehicle: ${run.truck?.registrationPlate || 'N/A'}`);
    if (run.trailer?.registrationPlate) {
      doc.text(`Trailer: ${run.trailer.registrationPlate}`);
    }
    doc.moveDown(2);

    // --- Tabela ze zleceniami ---
    const tableTop = doc.y;
    const columnWidths = [100, 120, 120, 50, 50];
    const headers = ['Consignment #', 'Sender', 'Recipient', 'Pallets', 'Weight (kg)'];

    // Nagłówki tabeli
    doc.font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.text(header, 50 + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop);
    });
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Wiersze tabeli
    doc.font('Helvetica');
    orders.forEach(order => {
      const rowY = doc.y;
      const totalPallets = (order.cargoDetails?.pallets || []).reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
      const totalKilos = order.cargoDetails?.total_kilos || 0;

      doc.text(order.orderNumber || order.customerReference, 50, rowY, { width: columnWidths[0] - 10 });
      doc.text(order.senderDetails?.name || 'N/A', 50 + columnWidths[0], rowY, { width: columnWidths[1] - 10 });
      doc.text(order.recipientDetails?.name || 'N/A', 50 + columnWidths[0] + columnWidths[1], rowY, { width: columnWidths[2] - 10 });
      doc.text(totalPallets, 50 + columnWidths.slice(0, 3).reduce((a, b) => a + b, 0), rowY, { width: columnWidths[3] - 10 });
      doc.text(totalKilos, 50 + columnWidths.slice(0, 4).reduce((a, b) => a + b, 0), rowY, { width: columnWidths[4] - 10 });
      doc.moveDown(1.5);
    });

    // --- Stopka ---
    const pageHeight = doc.page.height;
    doc.fontSize(8).text(`Generated on: ${new Date().toLocaleString()}`, 50, pageHeight - 50, { align: 'left' });

    doc.end();
  });
};

module.exports = {
  generateRunManifestPDF,
};