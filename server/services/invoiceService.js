// Plik: server/services/invoiceService.js
const { Invoice, Order, InvoiceItem, Customer, sequelize } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

// --- Konfiguracja ---
const DUE_DATE_DAYS = 14; // Domyślny termin płatności w dniach
const INITIAL_INVOICE_STATUS = 'unpaid';

/**
 * Generuje następny numer faktury w formacie ROK/MIESIĄC/NUMER.
 * Ta funkcja jest podatna na "race condition" przy bardzo wysokim obciążeniu.
 * @param {import('sequelize').Transaction} transaction - Opcjonalna transakcja Sequelize.
 * @returns {Promise<string>} Nowy numer faktury.
 */
const getNextInvoiceNumber = async (transaction) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const prefix = `${year}/${String(month).padStart(2, '0')}/`;

  const lastInvoice = await Invoice.findOne({
    where: { invoiceNumber: { [Op.like]: `${prefix}%` } },
    order: [['invoiceNumber', 'DESC']],
    attributes: ['invoiceNumber'],
    transaction,
  });

  if (!lastInvoice) {
    return `${prefix}1`;
  }

  const lastNumber = Number.parseInt(lastInvoice.invoiceNumber.split('/').pop(), 10);
  return `${prefix}${lastNumber + 1}`;
};

/**
 * Tworzy nową fakturę dla danego klienta i zakresu dat.
 * @param {number} customerId - ID klienta.
 * @param {string} startDateStr - Data początkowa (YYYY-MM-DD).
 * @param {string} endDateStr - Data końcowa (YYYY-MM-DD).
 * @returns {Promise<object>} Nowo utworzona faktura.
 */
const createInvoice = async (customerId, startDateStr, endDateStr) => {
  logger.info(`Attempting to create invoice for customerId: ${customerId} from ${startDateStr} to ${endDateStr}`);

  return sequelize.transaction(async (t) => {
    // 1. Znajdź wszystkie niezapłacone zlecenia dla klienta w danym okresie.
    const ordersToInvoice = await Order.findAll({
      where: {
        customerId: customerId,
        invoiceId: null,
        unloadingDateTime: {
          [Op.between]: [startDateStr, `${endDateStr}T23:59:59.999Z`],
        },
      },
      attributes: ['id', 'finalPrice'],
      transaction: t,
    });
    
    if (ordersToInvoice.length === 0) {
      logger.warn(`No uninvoiced orders found for customerId: ${customerId} in the selected date range.`);
      throw new Error('No uninvoiced orders found for the selected customer and date range.');
    }

    // 2. Oblicz sumę i przygotuj pozycje faktury.
    const totalAmount = ordersToInvoice.reduce((sum, order) => sum + Number(order.finalPrice || 0), 0);

    // 3. Wygeneruj numer faktury i datę płatności.
    const invoiceNumber = await getNextInvoiceNumber(t);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + DUE_DATE_DAYS);

    // 4. Wstaw nową fakturę do tabeli `invoices`.
    const newInvoice = await Invoice.create({
      invoiceNumber,
      customerId,
      issueDate: new Date(),
      dueDate: dueDate.toISOString().split('T')[0],
      totalAmount: totalAmount.toFixed(2),
      status: INITIAL_INVOICE_STATUS,
    }, { transaction: t });

    // 5. Wstaw pozycje faktury i zaktualizuj zlecenia.
    const invoiceItemsToCreate = ordersToInvoice.map(order => ({
      invoiceId: newInvoice.id,
      orderId: order.id,
      description: `Order #${order.id}`, // Można dodać bardziej szczegółowy opis
      amount: order.finalPrice,
    }));

    await InvoiceItem.bulkCreate(invoiceItemsToCreate, { transaction: t });

    // Zaktualizuj wszystkie powiązane zlecenia za jednym razem
    const orderIds = ordersToInvoice.map(order => order.id);
    await Order.update(
      { invoiceId: newInvoice.id },
      { where: { id: { [Op.in]: orderIds } }, transaction: t }
    );

    logger.info(`Successfully created invoice ${newInvoice.invoiceNumber} (ID: ${newInvoice.id}) with ${ordersToInvoice.length} items.`);
    return newInvoice;
  });
};

const findAllInvoices = async () => {
  try {
    return await Invoice.findAll({
      include: [{
        model: Customer,
        as: 'customer',
        attributes: ['name'],
      }],
      order: [['issueDate', 'DESC'], ['id', 'DESC']],
    });
  } catch (error) {
    logger.error('Error finding all invoices', { error: error.message });
    throw error;
  }
};

module.exports = {
  createInvoice,
  findAllInvoices,
  // Eksportujemy na potrzeby testów lub innych serwisów
  getNextInvoiceNumber, 
};