// Plik server/services/assignmentService.js
const { Assignment, Order, sequelize } = require('../models');
const { Op } = require('sequelize');

const createAssignment = async ({ orderId, runId, notes }) => {
  // Używamy transakcji, aby zapewnić, że obie operacje (wstawienie i aktualizacja) powiodą się lub żadna.
  return sequelize.transaction(async (t) => {
    // Krok 1: Stwórz nowe przypisanie używając modelu Sequelize
    const newAssignment = await Assignment.create(
      { orderId, runId, notes },
      { transaction: t }
    );

    // Krok 2: Zaktualizuj status zlecenia na "zaplanowane"
    await Order.update(
      { status: 'zaplanowane' },
      { where: { id: orderId }, transaction: t }
    );

    // Krok 3: Zwróć nowo utworzone przypisanie
    return newAssignment;
  });
};

const findAllAssignments = async () => {
  // paranoid: true w modelu automatycznie dodaje `WHERE is_deleted = FALSE`
  return Assignment.findAll({
    order: [['createdAt', 'DESC']],
  });
};

const deleteAssignment = async (assignmentId) => {
  // Używamy transakcji, aby zapewnić spójność danych
  return sequelize.transaction(async (t) => {
    // Krok 1: Znajdź przypisanie, aby uzyskać order_id
    const assignment = await Assignment.findByPk(assignmentId, { transaction: t });

    if (!assignment) {
      return 0; // Przypisanie nie istnieje
    }

    // Krok 2: Usuń przypisanie (soft delete)
    const deletedRows = await Assignment.destroy({
      where: { id: assignmentId },
      transaction: t,
    });

    // Krok 3: Zaktualizuj status zlecenia z powrotem na "nowe"
    await Order.update(
      { status: 'nowe' },
      { where: { id: assignment.orderId }, transaction: t }
    );

    return deletedRows;
  });
};

const bulkCreateAssignments = async (runId, orderIds) => {
  // Używamy transakcji, aby zapewnić, że wszystkie przypisania zostaną utworzone, albo żadne.
  return sequelize.transaction(async (t) => {
    if (!orderIds || orderIds.length === 0) {
      return { createdCount: 0 };
    }

    // Krok 1: Usuń istniejące przypisania dla tych zleceń, aby uniknąć duplikatów.
    await Assignment.destroy({
      where: { orderId: { [Op.in]: orderIds } },
      transaction: t,
    });

    // Krok 2: Stwórz nowe przypisania za pomocą `bulkCreate`
    const assignmentsToCreate = orderIds.map(orderId => ({ runId, orderId }));
    const newAssignments = await Assignment.bulkCreate(assignmentsToCreate, { transaction: t });

    // Krok 3: Zaktualizuj status wszystkich przypisanych zleceń na 'zaplanowane'
    await Order.update(
      { status: 'zaplanowane' },
      { where: { id: { [Op.in]: orderIds } }, transaction: t }
    );

    return { createdCount: newAssignments.length };
  });
};

module.exports = {
  createAssignment,
  findAllAssignments,
  deleteAssignment,
  bulkCreateAssignments,
};