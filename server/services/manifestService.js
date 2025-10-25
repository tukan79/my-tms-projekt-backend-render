// Plik: server/services/manifestService.js
const PDFDocument = require('pdfkit');
const db = require('../db/index.js');

const generateRunManifestPDF = async (runId) => {
  // 1. Pobierz wszystkie niezbędne dane za jednym razem
  const runQuery = `
    SELECT 
      r.id as run_id, 
      TO_CHAR(r.run_date, 'DD-MM-YYYY') as run_date,
      d.first_name || ' ' || d.last_name as driver_name,
      t.registration_plate as truck_plate,
      tr.registration_plate as trailer_plate
    FROM runs r
    LEFT JOIN drivers d ON r.driver_id = d.id
    LEFT JOIN trucks t ON r.truck_id = t.id
    LEFT JOIN trailers tr ON r.trailer_id = tr.id
    WHERE r.id = $1;
  `;

  const ordersQuery = `
    SELECT 
      o.order_number,
      o.customer_reference,
      o.sender_details,
      o.recipient_details,
      o.cargo_details
    FROM orders o
    JOIN assignments a ON o.id = a.order_id
    WHERE a.run_id = $1
    ORDER BY a.created_at;
  `;

  const [runResult, ordersResult] = await Promise.all([
    db.query(runQuery, [runId]),
    db.query(ordersQuery, [runId])
  ]);

  if (runResult.rows.length === 0) {
    throw new Error('Run not found');
  }

  const run = runResult.rows[0];
  const orders = ordersResult.rows;

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
    doc.fontSize(20).font('Helvetica-Bold').text(`Run Manifest: #${run.run_id}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica');
    doc.text(`Date: ${run.run_date}`);
    doc.text(`Driver: ${run.driver_name || 'N/A'}`);
    doc.text(`Vehicle: ${run.truck_plate || 'N/A'}`);
    if (run.trailer_plate) {
      doc.text(`Trailer: ${run.trailer_plate}`);
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
      const totalPallets = Object.values(order.cargo_details?.pallets || {}).reduce((sum, p) => sum + (Number(p.count) || 0), 0);
      const totalKilos = order.cargo_details?.total_kilos || 0;

      doc.text(order.order_number || order.customer_reference, 50, rowY, { width: columnWidths[0] - 10 });
      doc.text(order.sender_details?.name || 'N/A', 50 + columnWidths[0], rowY, { width: columnWidths[1] - 10 });
      doc.text(order.recipient_details?.name || 'N/A', 50 + columnWidths[0] + columnWidths[1], rowY, { width: columnWidths[2] - 10 });
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

module.exports = { generateRunManifestPDF };