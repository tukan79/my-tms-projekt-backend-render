// Plik: server/controllers/orderController.js
const orderService = require('../services/orderService.js');
const labelService = require('../services/labelService.js');

exports.getAllOrders = async (req, res, next) => {
  try {
    const orders = await orderService.findAllOrders();
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

exports.createOrder = async (req, res, next) => {
  try {
    const newOrder = await orderService.createOrder(req.body);
    res.status(201).json(newOrder);
  } catch (error) {
    next(error);
  }
};

exports.updateOrder = async (req, res, next) => {
  try {
    const updatedOrder = await orderService.updateOrder(req.params.id, req.body);
    if (!updatedOrder) return res.status(404).json({ error: 'Order not found' });
    res.json(updatedOrder);
  } catch (error) {
    next(error);
  }
};

exports.deleteOrder = async (req, res, next) => {
  try {
    const changes = await orderService.deleteOrder(req.params.id);
    if (changes === 0) return res.status(404).json({ error: 'Order not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

exports.generateLabels = async (req, res, next) => {
  try {
    const pdfBuffer = await labelService.generatePalletLabelsPDF(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="labels_order_${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

exports.importOrders = async (req, res, next) => {
  try {
    const { orders } = req.body;
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ error: 'Invalid data format. "orders" array is required.' });
    }
    const result = await orderService.importOrders(orders);
    res.status(201).json({ message: `Successfully processed ${result.count} orders.`, ...result });
  } catch (error) {
    next(error);
  }
};

exports.bulkDeleteOrders = async (req, res, next) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Invalid or empty array of order IDs provided.' });
  }
  try {
    const deletedCount = await orderService.bulkDeleteOrders(ids);
    res.status(200).json({ message: `${deletedCount} orders deleted successfully.` });
  } catch (error) {
    next(error);
  }
};