// Plik server/services/orderService.js
const { Order, Customer, OrderSurcharge, SurchargeType, sequelize } = require('../models');
const { Op } = require('sequelize');
const pricingService = require('./pricingService.js'); // Upewniamy się, że ścieżka jest jednoznaczna

const createOrder = async (orderData) => {
  return sequelize.transaction(async (t) => {
    const {
      customer_id: customerId,
      order_number: orderNumber,
      service_level: serviceLevel,
      customer_reference: customerReference,
      status,
      sender_details: senderDetails,
      recipient_details: recipientDetails,
      cargo_details: cargoDetails,
      loading_date_time: loadingDateTime,
      unloading_date_time: unloadingDateTime,
      selected_surcharges: selectedSurcharges,
      unloading_start_time: unloadingStartTime,
      unloading_end_time: unloadingEndTime,
    } = orderData;

    // Krok 1: Utwórz zlecenie
    const newOrder = await Order.create({
      customerId,
      orderNumber,
      serviceLevel,
      customerReference,
      status,
      senderDetails, // Sequelize automatycznie obsłuży JSONB
      recipientDetails, // Sequelize automatycznie obsłuży JSONB
      cargoDetails, // Sequelize automatycznie obsłuży JSONB
      loadingDateTime: loadingDateTime ? loadingDateTime.split('T')[0] : null,
      unloadingDateTime: unloadingDateTime ? unloadingDateTime.split('T')[0] : null,
      selectedSurcharges: selectedSurcharges || [],
      unloadingStartTime: unloadingStartTime || null,
      unloadingEndTime: unloadingEndTime || null,
    }, { transaction: t });

    // Krok 2: Oblicz cenę i dopłaty
    const priceResult = await pricingService.calculateOrderPrice(newOrder);
    if (!priceResult) {
      return newOrder; // Zwróć zlecenie bez ceny, jeśli wycena się nie powiodła
    }
    
    // Krok 3: Zapisz dopłaty w tabeli order_surcharges
    if (priceResult.breakdown?.surcharges?.length > 0) {
      const surchargesToCreate = priceResult.breakdown.surcharges.map(surcharge => ({
        orderId: newOrder.id,
        surchargeTypeId: surcharge.surchargeTypeId, // Zmieniono na camelCase
        calculatedAmount: surcharge.amount,
      }));
      await OrderSurcharge.bulkCreate(surchargesToCreate, { transaction: t });
    }

    // Krok 4: Zaktualizuj zlecenie o obliczoną cenę i szczegóły wyceny
    const updatedCargoDetails = { ...newOrder.cargoDetails, priceBreakdown: priceResult.breakdown };
    const [updatedRowsCount, updatedOrders] = await Order.update({
      calculatedPrice: priceResult.calculatedPrice,
      finalPrice: priceResult.finalPrice,
      cargoDetails: updatedCargoDetails,
    }, {
      where: { id: newOrder.id },
      returning: true,
      transaction: t,
    });

    return updatedRowsCount > 0 ? updatedOrders[0] : newOrder;
  });
};

const findAllOrders = async () => {
  return Order.findAll({
    where: { isDeleted: false }, // paranoid: true w modelu automatycznie dodaje ten warunek
    order: [['createdAt', 'DESC']],
    include: [{ model: Customer, as: 'customer', attributes: ['name', 'customerCode'] }], // Dołącz dane klienta
  });
};

const updateOrder = async (orderId, orderData) => {
  return sequelize.transaction(async (t) => {
    // Krok 1: Pobierz aktualny stan zlecenia z bazy danych.
    const existingOrder = await Order.findByPk(orderId, { transaction: t });
    if (!existingOrder) {
      return null; // Zlecenie nie istnieje
    }

    // Krok 2: Zmapuj przychodzące dane snake_case na camelCase
    const {
      customer_id: customerId, order_number: orderNumber, service_level: serviceLevel,
      customer_reference: customerReference, status, sender_details: senderDetails,
      recipient_details: recipientDetails, cargo_details: cargoDetails,
      loading_date_time: loadingDateTime, unloading_date_time: unloadingDateTime,
      selected_surcharges: selectedSurcharges, unloading_start_time: unloadingStartTime,
      unloading_end_time: unloadingEndTime, final_price: finalPrice
    } = orderData;

    // Krok 2a: Połącz istniejące dane z nowymi danymi z formularza.
    const mergedOrderData = {
      ...existingOrder.get({ plain: true }), // Pobierz czysty obiekt z istniejącego zlecenia
      // Użyj zmapowanych danych camelCase
      ...{
        customerId, orderNumber, serviceLevel, customerReference, status, senderDetails,
        recipientDetails, cargoDetails, loadingDateTime, unloadingDateTime, selectedSurcharges,
        unloadingStartTime, unloadingEndTime, finalPrice
      }
    };

    // Krok 3: Sprawdź, czy należy przeliczyć cenę.
    // Porównujemy kluczowe pola, które mają wpływ na cenę.
    const shouldRecalculatePrice = (
      JSON.stringify(existingOrder.cargoDetails) !== JSON.stringify(mergedOrderData.cargoDetails) ||
      existingOrder.senderDetails?.postCode !== mergedOrderData.senderDetails?.postCode ||
      existingOrder.recipientDetails?.postCode !== mergedOrderData.recipientDetails?.postCode ||
      existingOrder.serviceLevel !== mergedOrderData.serviceLevel ||
      JSON.stringify(existingOrder.selectedSurcharges) !== JSON.stringify(mergedOrderData.selectedSurcharges)
    );

    let priceResult = null;
    if (shouldRecalculatePrice) {
      console.log('🔄 Price-affecting field changed. Recalculating price...');
      try {
        // Przekazujemy mergedOrderData, które ma już camelCase
        priceResult = await pricingService.calculateOrderPrice(mergedOrderData); 
      } catch (error) {
        console.error(`⚠️ PRICING SKIPPED during update:`, error.message);
        priceResult = null; // Ustawiamy priceResult na null, aby reszta funkcji działała poprawnie.
      }
    } else {
      console.log('✅ No price-affecting fields changed. Skipping price recalculation.');
      // Jeśli nie przeliczamy, użyjemy istniejących cen i szczegółów wyceny.
      priceResult = {
        calculatedPrice: existingOrder.calculatedPrice,
        finalPrice: existingOrder.finalPrice,
        breakdown: existingOrder.cargoDetails?.priceBreakdown
      };
    }

    // Krok 4: Przygotuj ostateczne dane do zapisu.
    let finalCalculatedPrice = mergedOrderData.calculatedPrice;
    let finalFinalPrice = mergedOrderData.finalPrice;

    if (priceResult && priceResult.calculatedPrice > 0) {
      const hasManualPriceOverride = 'final_price' in orderData &&
                                     orderData.final_price !== '' &&
                                     parseFloat(orderData.final_price) !== priceResult.finalPrice;

      if (hasManualPriceOverride) {
        finalCalculatedPrice = priceResult.calculatedPrice;
        finalFinalPrice = parseFloat(orderData.final_price);
      } else {
        finalCalculatedPrice = priceResult.calculatedPrice;
        finalFinalPrice = priceResult.finalPrice;
      }

      mergedOrderData.cargoDetails = {
        ...mergedOrderData.cargoDetails,
        priceBreakdown: priceResult.breakdown
      };
    }

    // Krok 5: Zaktualizuj główne dane zlecenia.
    const [updatedRowsCount, updatedOrders] = await Order.update({
      customerId: mergedOrderData.customerId,
      orderNumber: mergedOrderData.orderNumber,
      serviceLevel: mergedOrderData.serviceLevel,
      customerReference: mergedOrderData.customerReference,
      status: mergedOrderData.status,
      senderDetails: mergedOrderData.senderDetails,
      recipientDetails: mergedOrderData.recipientDetails,
      cargoDetails: mergedOrderData.cargoDetails,
      loadingDateTime: mergedOrderData.loadingDateTime ? mergedOrderData.loadingDateTime.split('T')[0] : null,
      unloadingDateTime: mergedOrderData.unloadingDateTime ? mergedOrderData.unloadingDateTime.split('T')[0] : null,
      calculatedPrice: finalCalculatedPrice,
      finalPrice: finalFinalPrice,
      selectedSurcharges: mergedOrderData.selectedSurcharges || [],
      unloadingStartTime: mergedOrderData.unloadingStartTime || null,
      unloadingEndTime: mergedOrderData.unloadingEndTime || null,
    }, {
      where: { id: orderId },
      returning: true,
      transaction: t,
    });

    if (updatedRowsCount === 0) {
      return null;
    }

    // Krok 6: Zaktualizuj powiązane dopłaty w tabeli order_surcharges.
    // Najpierw usuwamy stare, potem dodajemy nowe.
    await OrderSurcharge.destroy({ where: { orderId: orderId }, transaction: t });

    if (priceResult?.breakdown?.surcharges?.length > 0) {
      const surchargesToCreate = priceResult.breakdown.surcharges.map(surcharge => ({
        orderId: orderId,
        surchargeTypeId: surcharge.surchargeTypeId, // Zmieniono na camelCase
        calculatedAmount: surcharge.amount,
      }));
      await OrderSurcharge.bulkCreate(surchargesToCreate, { transaction: t });
    }

    return updatedOrders[0];
  });
};

const importOrders = async (ordersData) => {
  return sequelize.transaction(async (t) => {
    // Pobierz mapowanie kodów klientów na ich ID
    const customers = await Customer.findAll({ attributes: ['id', 'customerCode'], transaction: t });
    const customerCodeToIdMap = new Map(customers.map(c => [c.customerCode, c.id]));

    const importedOrders = [];
    const errors = [];
    const ordersToCreateOrUpdate = [];

    for (const [index, order] of ordersData.entries()) {
      const customerId = customerCodeToIdMap.get(order.customerCode); // Używamy camelCase
      if (!customerId) {
        errors.push({ line: index + 2, message: `Customer with code '${order.customerCode}' not found.` });
        continue;
      }

      // Calculate price before inserting
      const priceResult = await pricingService.calculateOrderPrice({
        customerId: customerId,
        senderDetails: order.sender_details,
        recipientDetails: order.recipient_details,
        cargoDetails: order.cargo_details,
        selectedSurcharges: order.selected_surcharges || [],
        serviceLevel: order.service_level,
        unloadingStartTime: order.unloading_start_time,
        unloadingEndTime: order.unloading_end_time,
      });
      const updatedCargoDetails = priceResult ? { ...order.cargo_details, priceBreakdown: priceResult.breakdown } : order.cargo_details;

      ordersToCreateOrUpdate.push({
        customerId,
        orderNumber: order.orderNumber, // Używamy camelCase
        customerReference: order.customerReference, // Używamy camelCase
        status: order.status,
        senderDetails: order.senderDetails,
        recipientDetails: order.recipientDetails,
        cargoDetails: updatedCargoDetails,
        loadingDateTime: order.loadingDateTime,
        unloadingDateTime: order.unloadingDateTime,
        serviceLevel: order.serviceLevel,
        selectedSurcharges: order.selectedSurcharges || [],
        calculatedPrice: priceResult ? priceResult.calculatedPrice : null,
        finalPrice: priceResult ? priceResult.finalPrice : null,
        unloadingStartTime: order.unloading_start_time || null,
        unloadingEndTime: order.unloading_end_time || null,
      });
    }

    if (ordersToCreateOrUpdate.length > 0) {
      const createdOrUpdatedOrders = await Order.bulkCreate(ordersToCreateOrUpdate, {
        transaction: t,
        updateOnDuplicate: [
          'customerId', 'customerReference', 'status', 'senderDetails', 'recipientDetails',
          'cargoDetails', 'loadingDateTime', 'unloadingDateTime', 'serviceLevel',
          'selectedSurcharges', 'calculatedPrice', 'finalPrice', 'unloadingStartTime', 'unloadingEndTime',
        ],
      });
      importedOrders.push(...createdOrUpdatedOrders);

      // Po zaimportowaniu/zaktualizowaniu zleceń, musimy zaktualizować dopłaty
      for (const order of importedOrders) {
        // Ponownie oblicz cenę, aby uzyskać aktualne dopłaty
        const priceResult = await pricingService.calculateOrderPrice(order);
        if (priceResult?.breakdown?.surcharges?.length > 0) {
          await OrderSurcharge.destroy({ where: { orderId: order.id }, transaction: t });
          const surchargesToCreate = priceResult.breakdown.surcharges.map(surcharge => ({
            orderId: order.id,
            surchargeTypeId: surcharge.surchargeTypeId,
            calculatedAmount: surcharge.amount,
          }));
          await OrderSurcharge.bulkCreate(surchargesToCreate, { transaction: t });
        }
      }
    }

    return { count: importedOrders.length, importedIds: importedOrders.map(o => o.id), errors };
  });
};

const deleteOrder = async (orderId) => {
  // `destroy` z `paranoid: true` w modelu wykona soft delete
  return Order.destroy({ where: { id: orderId } });
};

const bulkDeleteOrders = async (orderIds) => {
  if (!orderIds || orderIds.length === 0) return 0;
  return Order.destroy({
    where: { id: { [Op.in]: orderIds } },
  });
};

module.exports = {
  createOrder,
  findAllOrders,
  updateOrder,
  importOrders,
  deleteOrder,
  bulkDeleteOrders,
};