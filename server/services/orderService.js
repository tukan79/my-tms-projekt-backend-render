// Plik: server/services/orderService.js
const {
  Order,
  Customer,
  OrderSurcharge,
  sequelize,
} = require('../models');
const { Op } = require('sequelize');
const pricingService = require('./pricingService.js');

/* ------------------------------------------------------------------
   HELPERS
------------------------------------------------------------------- */

const normalizeDate = (value) =>
  value ? value.split('T')[0] : null;

const recalcPriceIfNeeded = async (existing, incoming) => {
  const changed =
    JSON.stringify(existing.cargoDetails) !== JSON.stringify(incoming.cargoDetails) ||
    existing.serviceLevel !== incoming.serviceLevel ||
    existing.senderDetails?.postCode !== incoming.senderDetails?.postCode ||
    existing.recipientDetails?.postCode !== incoming.recipientDetails?.postCode ||
    JSON.stringify(existing.selectedSurcharges) !== JSON.stringify(incoming.selectedSurcharges);

  if (!changed) {
    console.log('ℹ️ Price not changed — keeping existing values');
    return {
      calculatedPrice: existing.calculatedPrice,
      finalPrice: existing.finalPrice,
      breakdown: existing.cargoDetails?.priceBreakdown || null,
    };
  }

  console.log('🔄 Recalculating price due to changed fields...');
  return pricingService.calculateOrderPrice(incoming);
};

/* ------------------------------------------------------------------
   CREATE ORDER
------------------------------------------------------------------- */

const createOrder = async (orderData) => {
  return sequelize.transaction(async (t) => {
    const {
      customer_id,
      order_number,
      service_level,
      customer_reference,
      status,
      sender_details,
      recipient_details,
      cargo_details,
      loading_date_time,
      unloading_date_time,
      selected_surcharges,
      unloading_start_time,
      unloading_end_time,
    } = orderData;

    const newOrder = await Order.create(
      {
        customerId: customer_id,
        orderNumber: order_number,
        serviceLevel: service_level,
        customerReference: customer_reference,
        status,
        senderDetails: sender_details,
        recipientDetails: recipient_details,
        cargoDetails: cargo_details,
        loadingDateTime: normalizeDate(loading_date_time),
        unloadingDateTime: normalizeDate(unloading_date_time),
        selectedSurcharges: selected_surcharges || [],
        unloadingStartTime: unloading_start_time || null,
        unloadingEndTime: unloading_end_time || null,
      },
      { transaction: t }
    );

    const price = await pricingService.calculateOrderPrice(newOrder).catch(() => null);

    if (price?.breakdown?.surcharges?.length) {
      await OrderSurcharge.bulkCreate(
        price.breakdown.surcharges.map((s) => ({
          orderId: newOrder.id,
          surchargeTypeId: s.surchargeTypeId,
          calculatedAmount: s.amount,
        })),
        { transaction: t }
      );
    }

    const cargoWithPrice = {
      ...newOrder.cargoDetails,
      priceBreakdown: price?.breakdown || null,
    };

    const [_, updated] = await Order.update(
      {
        calculatedPrice: price?.calculatedPrice || null,
        finalPrice: price?.finalPrice || null,
        cargoDetails: cargoWithPrice,
      },
      {
        where: { id: newOrder.id },
        returning: true,
        transaction: t,
      }
    );

    return updated[0];
  });
};

/* ------------------------------------------------------------------
   FIND ALL ORDERS
------------------------------------------------------------------- */

const findAllOrders = async () => {
  try {
    const orders = await Order.findAll({
      where: { isDeleted: false },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['name', 'customerCode'],
        },
      ],
    });

    return orders;
  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    throw error;
  }
};

/* ------------------------------------------------------------------
   UPDATE ORDER
------------------------------------------------------------------- */

const updateOrder = async (orderId, orderData) => {
  return sequelize.transaction(async (t) => {
    const existing = await Order.findByPk(orderId, { transaction: t });
    if (!existing) return null;

    const incoming = {
      ...existing.get({ plain: true }),

      customerId: orderData.customer_id ?? existing.customerId,
      orderNumber: orderData.order_number ?? existing.orderNumber,
      customerReference: orderData.customer_reference ?? existing.customerReference,
      status: orderData.status ?? existing.status,

      senderDetails: orderData.sender_details ?? existing.senderDetails,
      recipientDetails: orderData.recipient_details ?? existing.recipientDetails,
      cargoDetails: orderData.cargo_details ?? existing.cargoDetails,

      serviceLevel: orderData.service_level ?? existing.serviceLevel,
      selectedSurcharges: orderData.selected_surcharges ?? existing.selectedSurcharges,

      loadingDateTime: normalizeDate(orderData.loading_date_time) ?? existing.loadingDateTime,
      unloadingDateTime: normalizeDate(orderData.unloading_date_time) ?? existing.unloadingDateTime,

      unloadingStartTime: orderData.unloading_start_time ?? existing.unloadingStartTime,
      unloadingEndTime: orderData.unloading_end_time ?? existing.unloadingEndTime,

      finalPrice: orderData.final_price ?? existing.finalPrice,
    };

    const price = await recalcPriceIfNeeded(existing, incoming);

    const manualOverride =
      orderData.final_price &&
      Number.parseFloat(orderData.final_price) !== price.finalPrice;

    if (manualOverride) {
      incoming.finalPrice = Number.parseFloat(orderData.final_price);
      incoming.calculatedPrice = price.calculatedPrice;
    } else {
      incoming.finalPrice = price.finalPrice;
      incoming.calculatedPrice = price.calculatedPrice;
    }

    incoming.cargoDetails = {
      ...incoming.cargoDetails,
      priceBreakdown: price.breakdown,
    };

    const [count, updated] = await Order.update(
      {
        customerId: incoming.customerId,
        orderNumber: incoming.orderNumber,
        customerReference: incoming.customerReference,
        status: incoming.status,
        senderDetails: incoming.senderDetails,
        recipientDetails: incoming.recipientDetails,
        cargoDetails: incoming.cargoDetails,
        loadingDateTime: incoming.loadingDateTime,
        unloadingDateTime: incoming.unloadingDateTime,
        calculatedPrice: incoming.calculatedPrice,
        finalPrice: incoming.finalPrice,
        selectedSurcharges: incoming.selectedSurcharges,
        unloadingStartTime: incoming.unloadingStartTime,
        unloadingEndTime: incoming.unloadingEndTime,
      },
      { where: { id: orderId }, returning: true, transaction: t }
    );

    if (count === 0) return null;

    await OrderSurcharge.destroy({
      where: { orderId },
      transaction: t,
    });

    if (price?.breakdown?.surcharges?.length) {
      await OrderSurcharge.bulkCreate(
        price.breakdown.surcharges.map((s) => ({
          orderId,
          surchargeTypeId: s.surchargeTypeId,
          calculatedAmount: s.amount,
        })),
        { transaction: t }
      );
    }

    return updated[0];
  });
};

/* ------------------------------------------------------------------
   IMPORT ORDERS
------------------------------------------------------------------- */

const importOrders = async (ordersData) => {
  return sequelize.transaction(async (t) => {
    const customers = await Customer.findAll({
      attributes: ['id', 'customerCode'],
      transaction: t,
    });

    const map = new Map(customers.map((c) => [c.customerCode, c.id]));

    const imported = [];
    const errors = [];

    for (const [idx, row] of ordersData.entries()) {
      const customerId = map.get(row.customer_code);

      if (!customerId) {
        errors.push({
          line: idx + 2,
          message: `Customer '${row.customer_code}' not found.`,
        });
        continue;
      }

      const price = await pricingService
        .calculateOrderPrice({
          customer_id: customerId,
          senderDetails: row.sender_details,
          recipientDetails: row.recipient_details,
          cargoDetails: row.cargo_details,
          selectedSurcharges: row.selected_surcharges || [],
          serviceLevel: row.service_level,
          unloadingStartTime: row.unloading_start_time,
          unloadingEndTime: row.unloading_end_time,
        })
        .catch(() => null);

      imported.push({
        customerId,
        orderNumber: row.order_number,
        customerReference: row.customer_reference,
        status: row.status,
        senderDetails: row.sender_details,
        recipientDetails: row.recipient_details,
        cargoDetails: {
          ...row.cargo_details,
          priceBreakdown: price?.breakdown || null,
        },
        loadingDateTime: normalizeDate(row.loading_date_time),
        unloadingDateTime: normalizeDate(row.unloading_date_time),
        serviceLevel: row.service_level,
        selectedSurcharges: row.selected_surcharges || [],
        calculatedPrice: price?.calculatedPrice || null,
        finalPrice: price?.finalPrice || null,
        unloadingStartTime: row.unloading_start_time || null,
        unloadingEndTime: row.unloading_end_time || null,
      });
    }

    const created = await Order.bulkCreate(imported, {
      transaction: t,
      updateOnDuplicate: [
        'customerId',
        'customerReference',
        'status',
        'senderDetails',
        'recipientDetails',
        'cargoDetails',
        'loadingDateTime',
        'unloadingDateTime',
        'serviceLevel',
        'selectedSurcharges',
        'calculatedPrice',
        'finalPrice',
        'unloadingStartTime',
        'unloadingEndTime',
      ],
    });

    for (const order of created) {
      const price = await pricingService.calculateOrderPrice(order);
      if (!price?.breakdown?.surcharges?.length) continue;

      await OrderSurcharge.destroy({
        where: { orderId: order.id },
        transaction: t,
      });

      await OrderSurcharge.bulkCreate(
        price.breakdown.surcharges.map((s) => ({
          orderId: order.id,
          surchargeTypeId: s.surchargeTypeId,
          calculatedAmount: s.amount,
        })),
        { transaction: t }
      );
    }

    return { count: created.length, importedIds: created.map((x) => x.id), errors };
  });
};

/* ------------------------------------------------------------------
   DELETE
------------------------------------------------------------------- */

const deleteOrder = (id) =>
  Order.destroy({ where: { id } }); // soft delete (paranoid)

const bulkDeleteOrders = (ids) =>
  Order.destroy({ where: { id: { [Op.in]: ids } } });

/* ------------------------------------------------------------------
   EXPORT
------------------------------------------------------------------- */

module.exports = {
  createOrder,
  findAllOrders,
  updateOrder,
  importOrders,
  deleteOrder,
  bulkDeleteOrders,
};
