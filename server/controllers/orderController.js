// Plik server/controllers/orderController.js
const orderService = require('../services/orderService.js');

exports.getAllOrders = async (req, res, next) => {
  try {
    const orders = await orderService.findAllOrders();
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

exports.updateOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const orderData = req.body;
    const { loading_date_time, unloading_date_time } = orderData;

    // --- Walidacja po stronie serwera dla aktualizacji ---
    if (loading_date_time && unloading_date_time) {
      const loadingDate = new Date(loading_date_time);
      const unloadingDate = new Date(unloading_date_time);

      if (isNaN(loadingDate.getTime()) || isNaN(unloadingDate.getTime())) {
        return res.status(400).json({ error: 'Nieprawidłowy format daty.' });
      }

      if (unloadingDate <= loadingDate) {
        return res.status(400).json({ error: 'Data rozładunku musi być późniejsza niż data załadunku.' });
      }
    }

    if (!orderData.sender_details?.name || !orderData.recipient_details?.name) {
      return res.status(400).json({ error: 'Nazwa nadawcy i odbiorcy jest wymagana.' });
    }
    // --- Koniec walidacji ---

    const updatedOrder = await orderService.updateOrder(orderId, orderData);

    if (!updatedOrder) {
      return res.status(404).json({ error: 'Nie znaleziono zlecenia do aktualizacji.' });
    }
    res.json(updatedOrder);
  } catch (error) {
    next(error);
  }
};

exports.createOrder = async (req, res, next) => {
  try {
    const { loading_date_time, unloading_date_time, sender_details, recipient_details } = req.body;

    // --- Walidacja po stronie serwera ---
    if (!loading_date_time || !unloading_date_time || !sender_details || !recipient_details) {
      return res.status(400).json({ error: 'Brak wymaganych pól (daty, dane nadawcy/odbiorcy).' });
    }

    if (!sender_details.name || !recipient_details.name) {
      return res.status(400).json({ error: 'Sender/recipient name and city are required.' });
    }

    const loadingDate = new Date(loading_date_time);
    const unloadingDate = new Date(unloading_date_time);

    if (isNaN(loadingDate.getTime()) || isNaN(unloadingDate.getTime())) {
      return res.status(400).json({ error: 'Nieprawidłowy format daty.' });
    }

    if (unloadingDate <= loadingDate) {
      return res.status(400).json({ error: 'Data rozładunku musi być późniejsza niż data załadunku.' });
    }
    // --- Koniec walidacji ---

    const newOrder = await orderService.createOrder(req.body);
    res.status(201).json(newOrder);
  } catch (error) {
    next(error);
  }
};

exports.importOrders = async (req, res, next) => {
  try {
    const ordersData = req.body;
    if (!Array.isArray(ordersData) || ordersData.length === 0) {
      return res.status(400).json({ error: 'Oczekiwano tablicy zleceń w ciele żądania.' });
    }

    const result = await orderService.importOrders(ordersData);
    res.status(201).json({ message: `Pomyślnie zaimportowano ${result.count} zleceń.`, ...result });
  } catch (error) {
    next(error);
  }
};

exports.deleteOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const changes = await orderService.deleteOrder(orderId);

    if (changes === 0) {
      return res.status(404).json({ error: 'Nie znaleziono zlecenia do usunięcia.' });
    }
    res.status(204).send(); // 204 No Content - standard dla pomyślnego usunięcia
  } catch (error) {
    next(error);
  }
};