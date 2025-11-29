// server/services/assignmentService.js
const { Assignment, Order, Run, sequelize } = require('../models');

const normalizeIds = ({ order_id, orderId, run_id, runId }) => ({
  orderId: order_id ?? orderId,
  runId: run_id ?? runId,
});

const findAllAssignments = async () => {
  try {
    return await Assignment.findAll({
      include: [
        { model: Order, as: 'order' },
        { model: Run, as: 'run' },
      ],
      order: [['createdAt', 'DESC']],
    });
  } catch (error) {
    console.error('findAllAssignments error:', error);
    return [];
  }
};

const createAssignment = async (payload) => {
  const { orderId, runId } = normalizeIds(payload);
  const notes = payload.notes ?? null;

  if (!orderId || !runId) {
    throw new Error('orderId and runId are required');
  }

  return sequelize.transaction(async (t) => {
    // Ensure referenced records exist to avoid foreign key errors
    const [order, run] = await Promise.all([
      Order.findByPk(orderId, { transaction: t }),
      Run.findByPk(runId, { transaction: t }),
    ]);

    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }
    if (!run) {
      const err = new Error('Run not found');
      err.statusCode = 404;
      throw err;
    }

    // Replace existing assignment for this order (keep one active assignment)
    await Assignment.destroy({ where: { orderId }, transaction: t });

    return Assignment.create({ orderId, runId, notes }, { transaction: t });
  });
};

const deleteAssignment = async (assignmentId) => {
  return Assignment.destroy({ where: { id: assignmentId } });
};

const bulkCreateAssignments = async (runId, orderIds = [], notes = null) => {
  if (!runId || !Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error('runId and orderIds are required');
  }

  const uniqueOrderIds = [...new Set(orderIds)];

  return sequelize.transaction(async (t) => {
    const run = await Run.findByPk(runId, { transaction: t });
    if (!run) {
      const err = new Error('Run not found');
      err.statusCode = 404;
      throw err;
    }

    const orders = await Order.findAll({
      where: { id: uniqueOrderIds },
      attributes: ['id'],
      transaction: t,
    });
    if (orders.length !== uniqueOrderIds.length) {
      const missing = uniqueOrderIds.filter(
        (id) => !orders.some((o) => o.id === id)
      );
      const err = new Error(`Orders not found: ${missing.join(', ')}`);
      err.statusCode = 404;
      throw err;
    }

    await Assignment.destroy({ where: { orderId: uniqueOrderIds }, transaction: t });

    const created = await Assignment.bulkCreate(
      uniqueOrderIds.map((orderId) => ({ orderId, runId, notes })),
      { transaction: t }
    );

    return {
      createdCount: created.length,
      createdIds: created.map((a) => a.id),
    };
  });
};

module.exports = {
  findAllAssignments,
  createAssignment,
  deleteAssignment,
  bulkCreateAssignments,
};
