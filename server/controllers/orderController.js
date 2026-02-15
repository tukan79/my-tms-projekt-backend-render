// Plik: server/controllers/orderController.js
const orderService = require('../services/orderService.js');
const labelService = require('../services/labelService.js');
const Papa = require('papaparse');

/* ---------------------------------------------
   Helpers
--------------------------------------------- */
const getUserId = (req) =>
  req.user?.id || req.auth?.userId || null;

const ensureOwnershipOrAdmin = (order, user) => {
  if (!order) return { ok: false, code: 404, msg: 'Order not found' };

  // Admin ma pełny dostęp
  if (user?.role === 'admin') return { ok: true };

  // Właściciel zamówienia
  if (order.created_by_user_id === user?.id) return { ok: true };

  return { ok: false, code: 403, msg: 'Forbidden' };
};

/* ---------------------------------------------
   Controllers
--------------------------------------------- */

exports.getAllOrders = async (req, res, next) => {
  try {
    const orders = await orderService.findAllOrders();
    res.status(200).json(orders || []);
  } catch (error) {
    console.error('getAllOrders error:', error);
    next(error);
  }
};

exports.createOrder = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: missing user identity' });
    }

    const orderData = {
      ...req.body,
      created_by_user_id: userId,
    };

    const newOrder = await orderService.createOrder(orderData);
    res.status(201).json(newOrder);
  } catch (error) {
    console.error('createOrder error:', error);
    next(error);
  }
};

exports.updateOrder = async (req, res, next) => {
  try {
    const orderId = req.params.id;

    const order = await orderService.findOrderById(orderId);
    const check = ensureOwnershipOrAdmin(order, req.user);

    if (!check.ok) {
      return res.status(check.code).json({ error: check.msg });
    }

    const updatedOrder = await orderService.updateOrder(orderId, { ...req.body });

    res.json(updatedOrder);
  } catch (error) {
    console.error('updateOrder error:', error);
    next(error);
  }
};

exports.deleteOrder = async (req, res, next) => {
  try {
    const orderId = req.params.id;

    const order = await orderService.findOrderById(orderId);
    const check = ensureOwnershipOrAdmin(order, req.user);

    if (!check.ok) {
      return res.status(check.code).json({ error: check.msg });
    }

    const changes = await orderService.deleteOrder(orderId);
    if (changes === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('deleteOrder error:', error);
    next(error);
  }
};

exports.generateLabels = async (req, res, next) => {
  try {
    const pdfBuffer = await labelService.generatePalletLabelsPDF(req.params.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="labels_order_${req.params.id}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error('generateLabels error:', error);
    next(error);
  }
};

exports.importOrders = async (req, res, next) => {
  try {
    const toDateTime = (dateStr, timeStr) => {
      if (!dateStr) return null;
      const date = String(dateStr).split('T')[0];
      if (!timeStr) return date;
      return `${date}T${timeStr}`;
    };

    const toBoolean = (value) => {
      if (typeof value === 'string') {
        return ['true', 'yes', '1', 'y', 't'].includes(value.toLowerCase());
      }
      return Boolean(value);
    };

    const mapLegacyRow = (row) => {
      if (!row?.ConsignmentNumber) return row;

      const surcharges = [];
      ['Surcharge1', 'Surcharge2', 'Surcharge3', 'Surcharge4', 'Surcharge5'].forEach((key) => {
        if (row[key]) surcharges.push(row[key]);
      });
      if (row.Surcharges) surcharges.push(row.Surcharges);

      return {
        order_number: row.ConsignmentNumber,
        customer_code: row.AccountCode,
        customer_reference: row.CustomerReference || row.CustomerReference2 || null,
        status: row.ConsignmentType || 'new',
        service_level: row.ServiceCode || null,
        sender_details: {
          name: row.CollectionName || null,
          address1: row.CollectionAddress1 || null,
          address2: row.CollectionAddress2 || null,
          town: row.CollectionTownCity || null,
          county: row.CollectionCounty || null,
          postCode: row.CollectionPostCode || null,
          country: row.CollectionCountry || null,
          contactName: row.CollectionContactName || null,
          phone: row.CollectionPhone || null,
          email: row.CollectionEmailAddress || null,
          note: [row.CollectionNoteLine1, row.CollectionNoteLine2, row.CollectionNoteLine3, row.CollectionNoteLine4]
            .filter(Boolean)
            .join(' ')
            .trim() || null,
          isResidential: toBoolean(row.CollectionIsResidential),
        },
        recipient_details: {
          name: row.DeliveryName || null,
          address1: row.DeliveryAddress1 || null,
          address2: row.DeliveryAddress2 || null,
          town: row.DeliveryTownCity || null,
          county: row.DeliveryCounty || null,
          postCode: row.DeliveryPostCode || null,
          country: row.DeliveryCountry || null,
          contactName: row.DeliveryContactName || null,
          phone: row.DeliveryPhone || null,
          email: row.DeliveryEmailAddress || null,
          note: [row.DeliveryNoteLine1, row.DeliveryNoteLine2, row.DeliveryNoteLine3, row.DeliveryNoteLine4]
            .filter(Boolean)
            .join(' ')
            .trim() || null,
          isResidential: toBoolean(row.DeliveryIsResidential),
        },
        cargo_details: {
          totalSpaces: Number(row.TotalSpaces) || 0,
          totalKilos: Number(row.TotalKilos) || 0,
          unitCode: row.UnitCode || null,
          quantities: {
            full: Number(row.FullQ) || 0,
            half: Number(row.HalfQ) || 0,
            halfPlus: Number(row.HalfPlusQ) || 0,
            quarter: Number(row.QuarterQ) || 0,
            micro: Number(row.MicroQ) || 0,
          },
          custPaperworkRequired: toBoolean(row.CustPaperworkRequired),
        },
        selected_surcharges: surcharges.filter(Boolean),
        loading_date_time: toDateTime(row.CollectionDate, row.CollectionTime),
        unloading_date_time: toDateTime(row.DeliveryDate, row.DeliveryTime),
        unloading_start_time: row.DeliveryTime || null,
        unloading_end_time: null,
      };
    };

    let normalizedData = [];

    // Mode 1: JSON payload from frontend importer ({ orders: [...] } or plain array)
    if (Array.isArray(req.body?.orders)) {
      normalizedData = req.body.orders;
    } else if (Array.isArray(req.body)) {
      normalizedData = req.body;
    } else if (req.file) {
      // Mode 2: CSV upload (legacy)
      const csvData = req.file.buffer.toString('utf-8');
      const parsed = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      });

      if (parsed.errors.length > 0) {
        console.error('CSV parse errors:', parsed.errors);
        return res.status(400).json({
          error: 'Error parsing CSV file.',
          details: parsed.errors,
        });
      }

      normalizedData = parsed.data.map((row) => (row.ConsignmentNumber ? mapLegacyRow(row) : row));
    } else {
      return res.status(400).json({
        error: 'Invalid import payload. Send CSV file or JSON body with "orders" array.',
      });
    }

    if (!Array.isArray(normalizedData) || normalizedData.length === 0) {
      return res.status(400).json({ error: 'No orders to import.' });
    }

    const result = await orderService.importOrders(normalizedData);

    res.status(201).json({
      message: `Successfully processed ${result.count} orders.`,
      ...result,
    });
  } catch (error) {
    console.error('importOrders error:', error);
    next(error);
  }
};

exports.bulkDeleteOrders = async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty array of IDs.' });
    }

    if (ids.some((id) => typeof id !== 'number')) {
      return res.status(400).json({ error: 'All IDs must be numbers.' });
    }

    const deletedCount = await orderService.bulkDeleteOrders(ids);

    res.json({
      message: `${deletedCount} orders deleted successfully.`,
      count: deletedCount,
    });
  } catch (error) {
    console.error('bulkDeleteOrders error:', error);
    next(error);
  }
};
