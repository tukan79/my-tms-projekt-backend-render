import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import api from '@/services/api.js';
import { useToast } from '@/contexts/ToastContext.jsx';
import { useApiResource } from '@/hooks/useApiResource.js';
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
  
  // POPRAWKA: Upewniamy się, że pobieramy assignments z initialData
  const { 
    orders = [], 
    runs = [], 
    drivers = [], 
    trucks = [], 
    trailers = [], 
    pallets = [], // Dodajemy pallets
    assignments: initialAssignmentsFromData = [], // ZMIANA: assignments zamiast initialAssignments
    zones = [] 
  } = initialData;

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

  const triggerRefresh = useCallback(() => {
    if (onAssignmentCreated) {
      onAssignmentCreated();
    }
  }, [onAssignmentCreated]);

  // --- Performance Optimization: Create stable lookup maps ---
  const driverMap = useMemo(() => new Map(drivers.map(d => [d.id, d])), [drivers]);
  const truckMap = useMemo(() => new Map(trucks.map(t => [t.id, t])), [trucks]);
  const trailerMap = useMemo(() => new Map(trailers.map(t => [t.id, t])), [trailers]);
  const orderMap = useMemo(() => new Map(orders.map(o => [o.id, o])), [orders]);

  // Memoize assignments grouped by run_id for quick lookups
  const assignmentsByRun = useMemo(() => {
    const map = new Map();
    for (const assignment of initialAssignmentsFromData) {
      if (!map.has(assignment.run_id)) {
        map.set(assignment.run_id, []);
      }
      map.get(assignment.run_id).push(assignment);
    }
    return map;
  }, [initialAssignmentsFromData]);

  const enrichedRuns = useMemo(() => {
    const filteredRuns = runs.filter(run => {
      if (!run.run_date) return false;
      return run.run_date.startsWith(selectedDate);
    });

    return filteredRuns.map(run => {
      const driver = driverMap.get(run.driver_id);
      const truck = truckMap.get(run.truck_id);
      const trailer = run.trailer_id ? trailerMap.get(run.trailer_id) : null;

      const runAssignments = assignmentsByRun.get(run.id) || [];
      const assignedOrders = runAssignments
        .map(a => orderMap.get(a.order_id))
        .filter(Boolean);

      const { totalKilos, totalSpaces } = assignedOrders.reduce((acc, order) => {
        acc.totalKilos += order.cargo_details?.total_kilos || 0;
        acc.totalSpaces += order.cargo_details?.total_spaces || 0;
        return acc;
      }, { totalKilos: 0, totalSpaces: 0 });

      const hasCapacity = truck?.type_of_truck === 'rigid' || (truck?.type_of_truck === 'tractor' && trailer);
      const maxPayload = hasCapacity ? (truck?.type_of_truck === 'rigid' ? truck.max_payload_kg : trailer?.max_payload_kg) : null;
      const maxPallets = hasCapacity ? (truck?.type_of_truck === 'rigid' ? truck.pallet_capacity : trailer?.max_spaces) : null;

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
  }, [runs, selectedDate, driverMap, truckMap, trailerMap, assignmentsByRun, orderMap]);

  // POPRAWKA: Upewniamy się, że przekazujemy poprawne assignments
  const assignmentsData = useMemo(() => {
    return {
      initialAssignments: initialAssignmentsFromData, // ZMIANA: initialAssignmentsFromData
      orders,
      enrichedRuns,
      onDataRefresh: triggerRefresh, // ZMIANA: triggerRefresh zamiast onAssignmentCreated
    };
  }, [initialAssignmentsFromData, orders, enrichedRuns, triggerRefresh]);

  const {
    assignments,
    availableOrders,
    handleDragEnd,
    handleDeleteAssignment,
    bulkAssignOrders,
    error,
  } = useAssignments(assignmentsData);

  // Obsługa błędów
  React.useEffect(() => {
    if (error) {
      console.error('❌ useAssignments error:', error);
      showToast(error, 'error');
    }
  }, [error, showToast]);

  const activeRun = useMemo(() => {
    return activeRunId ? enrichedRuns.find(run => run.id === activeRunId) : null;
  }, [activeRunId, enrichedRuns]);

  const ordersForActiveRun = useMemo(() => {
    if (!activeRun) return [];
    
    // POPRAWKA: Używamy assignments z hooka useAssignments
    const ordersForRun = assignments
      .filter(a => a.run_id === activeRun.id)
      .map(a => {
        const order = orderMap.get(a.order_id);
        return order ? { ...order, assignmentId: a.id } : null;
      })
      .filter(Boolean);

    return ordersForRun;
  }, [activeRun, assignments, orderMap]);

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
    try {
      // Normalizacja payloadu dla backendu: trailer_id jako null zamiast pustego stringa
      const payload = {
        ...runData,
        trailer_id: runData.trailer_id ? runData.trailer_id : null,
      };

      if (editingRun) {
        await runActions.update(editingRun.id, payload);
        showToast('Run updated successfully!', 'success');
      } else {
        await runActions.create(payload);
        showToast('Run created successfully!', 'success');
      }
      setIsFormVisible(false);
      setEditingRun(null);
      triggerRefresh();
      // Jeżeli zmieniono datę, przestaw filtr na dzień runa
      if (payload?.run_date && payload.run_date !== selectedDate) {
        setSelectedDate(payload.run_date);
        setActiveRunId(null); // Odznaczamy aktywny run, bo "przeskoczyliśmy" na inną datę
      }
    } catch (error) {
      console.error('❌ Error saving run:', error?.response?.status, error?.response?.data || error.message);
      showToast('Failed to save run: ' + (error?.response?.data?.message || error.message || 'Unknown error'), 'error');
    }
  }, [editingRun, runActions, showToast, triggerRefresh, selectedDate]);

  const handleDeleteRun = useCallback(async (run) => {
    if (window.confirm(`Are you sure you want to delete run: ${run.displayText}?`)) {
      try {
        await runActions.delete(run.id);
        showToast(`Run "${run.displayText}" deleted.`, 'success');
        triggerRefresh();
      } catch (error) {
        console.error('❌ Error deleting run:', error);
        showToast(error.response?.data?.error || 'Failed to delete run.', 'error');
      }
    }
  }, [runActions, showToast, triggerRefresh]);

  // POPRAWIONA: Funkcja usuwania assignmentu z odświeżaniem
  const handleDeleteAssignmentWithRefresh = useCallback(async (assignmentId) => {
    try {
      // Czekamy na zakończenie operacji usuwania z hooka useAssignments
      await handleDeleteAssignment(assignmentId);
      // Dopiero po pomyślnym usunięciu, odświeżamy dane
      triggerRefresh();
    } catch (error) {
      console.error('❌ Error during assignment deletion and refresh:', error);
      throw error;
    }
  }, [handleDeleteAssignment, triggerRefresh]);

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
        triggerRefresh(); // ZMIANA: Dodano odświeżanie
      } else {
        showToast(result.message, 'error');
      }
    } catch (error) {
      console.error('❌ Bulk assign failed:', error);
      showToast('An unexpected error occurred during bulk assignment.', 'error');
    }
  }, [activeRunId, selectedOrderIds, bulkAssignOrdersFromHook, showToast, triggerRefresh]);

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
        triggerRefresh(); // ZMIANA: triggerRefresh zamiast onAssignmentCreated
      } catch (error) {
        console.error('❌ Bulk delete failed:', error);
        showToast(error.response?.data?.error || 'Failed to delete orders.', 'error');
      }
    };
    
    onDeleteRequest(
      `Are you sure you want to delete ${selectedOrderIds.length} selected orders? This action cannot be undone.`, 
      onConfirm
    );
  }, [selectedOrderIds, onDeleteRequest, showToast, triggerRefresh]);

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
    handleDeleteAssignment: handleDeleteAssignmentWithRefresh, // ZMIANA: Używamy poprawionej funkcji
    // Dodajemy brakujące dane
    initialData: {
      drivers, trucks, trailers, zones, pallets,
    },
    // Dodajemy funkcję do ręcznego odświeżania
    triggerRefresh,
  };

  return <PlanItContext.Provider value={value}>{children}</PlanItContext.Provider>;
};