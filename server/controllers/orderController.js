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
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const csvData = req.file.buffer.toString('utf-8');
    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // bezpieczeństwo
    });

    if (parsed.errors.length > 0) {
      console.error('CSV parse errors:', parsed.errors);
      return res.status(400).json({
        error: 'Error parsing CSV file.',
        details: parsed.errors,
      });
    }

    const result = await orderService.importOrders(parsed.data);

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
