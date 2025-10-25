import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import api from '@/services/api.js';
import { useToast } from '@/contexts/ToastContext.jsx';
import { useAssignments } from '@/hooks/useAssignments.js';

const PlanItContext = createContext(null);

export const usePlanIt = () => {
  const context = useContext(PlanItContext);
  if (!context) {
    throw new Error('usePlanIt must be used within a PlanItProvider');
  }
  return context;
};

export const PlanItProvider = ({ children, initialData = {}, runActions, onAssignmentCreated, onDeleteRequest, bulkAssignOrders: bulkAssignOrdersFromHook }) => {
  const { showToast } = useToast();
  const { orders = [], runs = [], drivers = [], trucks = [], trailers = [], initialAssignments = [], zones = [] } = initialData;

  // State that was in PlanItPage
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeRunId, setActiveRunId] = useState(null);
  const [editingRun, setEditingRun] = useState(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
  });

  // Logic from PlanItPage/PlanItContent
  const enrichedRuns = useMemo(() => {
    return runs
      .filter(run => {
        if (!run.run_date) return false;
        return run.run_date.startsWith(selectedDate);
      })
      .map(run => {
        const driver = drivers.find(d => d.id === run.driver_id);
        const truck = trucks.find(t => t.id === run.truck_id);
        const trailer = run.trailer_id ? trailers.find(t => t.id === run.trailer_id) : null;

        const assignedOrders = initialAssignments
          .filter(a => a.run_id === run.id)
          .map(a => orders.find(o => o.id === a.order_id))
          .filter(Boolean);

        const totalKilos = assignedOrders.reduce((sum, order) => sum + (order.cargo_details?.total_kilos || 0), 0);
        const totalSpaces = assignedOrders.reduce((sum, order) => sum + (order.cargo_details?.total_spaces || 0), 0);

        let maxPayload = null;
        let maxPallets = null;
        let hasCapacity = false;

        if (truck?.type_of_truck === 'rigid') {
          maxPayload = truck.max_payload_kg;
          maxPallets = truck.pallet_capacity;
          hasCapacity = true;
        } else if (truck?.type_of_truck === 'tractor' && trailer) {
          maxPayload = trailer.max_payload_kg;
          maxPallets = trailer.max_spaces;
          hasCapacity = true;
        }

        return {
          ...run,
          displayText: `${driver ? `${driver.first_name} ${driver.last_name}` : 'No Driver'} - ${truck ? truck.registration_plate : 'No Truck'} ${trailer ? `+ ${trailer.registration_plate}` : ''}`,
          totalKilos,
          totalSpaces,
          maxPayload,
          maxPallets,
          hasCapacity,
        };
      });
  }, [runs, drivers, trucks, trailers, initialAssignments, orders, selectedDate]);

  // Poprawka: Używamy useMemo, aby ustabilizować dane przekazywane do useAssignments.
  const assignmentsData = useMemo(() => ({
    initialAssignments,
    orders,
    enrichedRuns,
    onDataRefresh: onAssignmentCreated,
  }), [initialAssignments, orders, enrichedRuns, onAssignmentCreated]);

  const {
    assignments,
    availableOrders,
    handleDragEnd, // Zmieniono z `deleteAssignment`
    handleDeleteAssignment,
    bulkAssignOrders, // Zmieniono z `bulkAssignOrders`
    error, // Zmieniono z `error`
  } = useAssignments(assignmentsData);

  // POPRAWIONE: Obsługa błędów w useEffect, aby uniknąć pętli renderowania.
  React.useEffect(() => {
    if (error) {
      showToast(error, 'error');
    }
  }, [error, showToast]);

  const activeRun = useMemo(() => activeRunId ? enrichedRuns.find(run => run.id === activeRunId) : null, [activeRunId, enrichedRuns]);

  const ordersForActiveRun = useMemo(() => {
    if (!activeRun) return [];
    return assignments.filter(a => a.run_id === activeRun.id).map(a => ({ ...orders.find(o => o.id === a.order_id), assignmentId: a.id }));
  }, [activeRun, assignments, orders]);

  // Handlers that were in PlanItPage
  const handleEditRun = useCallback((run) => {
    setEditingRun(run);
    setIsFormVisible(true);
  }, []);

  const handleAddNewRun = useCallback(() => {
    setEditingRun(null);
    setIsFormVisible(true);
  }, []);

  const handleSaveRun = useCallback(async (runData) => {
    if (editingRun) {
      await runActions.update(editingRun.id, runData);
      showToast('Run updated successfully!', 'success');
    } else {
      await runActions.create(runData);
      showToast('Run created successfully!', 'success');
    }
    setIsFormVisible(false);
    setEditingRun(null);
    if (onAssignmentCreated) onAssignmentCreated();
  }, [editingRun, runActions, onAssignmentCreated, showToast]);

  const handleDeleteRun = useCallback(async (run) => {
    onDeleteRequest(
      `Are you sure you want to delete run: ${run.displayText}?`,
      async () => {
        await runActions.delete(run.id);
        showToast(`Run "${run.displayText}" deleted.`, 'success');
        if (onAssignmentCreated) onAssignmentCreated();
      }
    );
  }, [runActions, showToast, onAssignmentCreated, onDeleteRequest]);

  const handleBulkAssign = useCallback(async () => {
    if (!activeRunId) {
      showToast('Please select an active run first.', 'error');
      return;
    }
    if (selectedOrderIds.length === 0) {
      showToast('No orders selected for assignment.', 'error');
      return;
    }

    try {
      const payload = {
        run_id: activeRunId,
        order_ids: selectedOrderIds,
      };
      const result = await bulkAssignOrdersFromHook(payload);
      if (result.success) {
        showToast(result.message, 'success');
        setSelectedOrderIds([]);
      } else {
        showToast(result.message, 'error');
      }
    } catch (error) {
      console.error('Bulk assign failed:', error);
      showToast('An unexpected error occurred during bulk assignment.', 'error');
    }
  }, [activeRunId, selectedOrderIds, bulkAssignOrdersFromHook, showToast, setSelectedOrderIds]);

  const handleBulkDelete = useCallback(() => {
    if (selectedOrderIds.length === 0) {
      showToast('No orders selected for deletion.', 'error');
      return;
    }
    const onConfirm = async () => {
      try {
        await api.delete('/api/orders/bulk', { data: { ids: selectedOrderIds } });
        showToast(`${selectedOrderIds.length} orders deleted successfully.`, 'success');
        setSelectedOrderIds([]);
        if (onAssignmentCreated) onAssignmentCreated();
      } catch (error) { showToast(error.response?.data?.error || 'Failed to delete orders.', 'error'); }
    };
    onDeleteRequest(`Are you sure you want to delete ${selectedOrderIds.length} selected orders? This action cannot be undone.`, onConfirm);
  }, [selectedOrderIds, onDeleteRequest, showToast, onAssignmentCreated, setSelectedOrderIds]);

  const value = {
    selectedDate,
    activeRunId,
    editingRun,
    isFormVisible,
    selectedOrderIds,
    contextMenu,
    setSelectedDate,
    setActiveRunId,
    setIsFormVisible,
    setSelectedOrderIds,
    setContextMenu,
    handleEditRun,
    handleAddNewRun,
    handleSaveRun,
    handleBulkAssign,
    handleBulkDelete,
    handleDeleteRun,
    // Data from hooks
    enrichedRuns,
    availableOrders,
    activeRun,
    ordersForActiveRun,
    handleDragEnd,
    handleDeleteAssignment,
    // Dodajemy brakujące dane, aby były dostępne w komponentach podrzędnych
    initialData: {
      drivers, trucks, trailers, zones,
    },
  };

  return <PlanItContext.Provider value={value}>{children}</PlanItContext.Provider>;
};