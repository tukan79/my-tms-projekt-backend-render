import React, { useMemo, useCallback } from 'react';
import { useApiResource } from './useApiResource';
import api from '@/services/api';
import { useBroadcastChannel } from '@/hooks/useBroadcastChannel';

export const useAssignments = ({ initialAssignments = [], orders = [], enrichedRuns = [], onDataRefresh }) => {
  console.log('🔧 useAssignments called with:', { initialAssignments, orders, enrichedRuns });

  const { 
    data: assignments, 
    error, 
    createResource: createAssignment, 
    deleteResource: deleteAssignment,
    setData: setAssignments 
  } = useApiResource('/api/assignments', 'assignment');

  React.useEffect(() => {
    // Ten useEffect powinien synchronizować stan wewnętrzny z danymi przychodzącymi z góry.
    setAssignments(initialAssignments);
  }, [initialAssignments, setAssignments]); // Uruchom ponownie, gdy zmienią się `initialAssignments`.

  const { postMessage } = useBroadcastChannel();

  const enrichedAssignments = useMemo(() => {
    return assignments.map(assignment => {
      const order = orders.find(o => o.id === assignment.order_id);
      const run = enrichedRuns.find(r => r.id === assignment.run_id);
      return {
        ...assignment,
        order_number: order?.order_number || order?.customer_reference || `ID: ${order?.id}`,
        run_text: run?.displayText || 'N/A',
        recipient_name: order?.recipient_details?.name || 'N/A',
      };
    });
  }, [assignments, orders, enrichedRuns]);

  const availableOrders = useMemo(() => {
    const assignedOrderIds = new Set(assignments.map(a => a.order_id));
    return orders.filter(o => o.status === 'nowe' && !assignedOrderIds.has(o.id));
  }, [orders, assignments]);

  const handleDragEnd = useCallback(async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination || (source.droppableId === destination.droppableId)) {
      return;
    }

    if (source.droppableId === 'orders' && destination.droppableId !== 'orders') {
      // Usuwamy prefix, jeśli istnieje, aby uzyskać czyste ID
      const cleanDraggableId = draggableId.startsWith('order-') ? draggableId.substring(6) : draggableId;
      const orderId = parseInt(cleanDraggableId, 10);
      
      // Sprawdzamy, czy upuszczono na listę kursów, czy na widok aktywnego kursu
      let runId;
      if (destination.droppableId.startsWith('run-active-')) {
        runId = parseInt(destination.droppableId.replace('run-active-', ''), 10);
      } else {
        runId = parseInt(destination.droppableId, 10);
      }
      
      const movedOrder = orders.find(o => o.id === orderId);
      if (!movedOrder) return;

      try {
        await createAssignment({ order_id: orderId, run_id: runId }, (newAssignment, tempId) => {
          const run = enrichedRuns.find(r => r.id === newAssignment.run_id);
          return {
            ...newAssignment,
            id: tempId,
            order_number: movedOrder.customer_reference || `ID: ${movedOrder.id}`,
            run_text: run?.displayText || 'N/A',
            recipient_name: movedOrder.recipient_details?.name || 'N/A',
          };
        });
        
        if (onDataRefresh) onDataRefresh();
        postMessage('refresh');
      } catch (err) {
        console.error("Failed to create assignment:", err);
      }
    }
  }, [createAssignment, orders, enrichedRuns, onDataRefresh, postMessage]);
  
  const handleDeleteAssignment = useCallback(async (assignmentId) => {
    console.log('🗑️ Deleting assignment:', assignmentId);
    try {
      await deleteAssignment(assignmentId);
      // Nie ma potrzeby odświeżania, useApiResource zarządza stanem.
      postMessage('refresh'); // Powiadom inne karty
      console.log('✅ Assignment deleted successfully');
    } catch (err) {
      console.error("❌ Error deleting assignment:", err);
    }
  }, [deleteAssignment, onDataRefresh, postMessage]);

  const bulkAssignOrders = useCallback(async (runId, orderIds) => {
    try {
      await api.post('/api/assignments/bulk', {
        run_id: runId,
        order_ids: orderIds,
      });
      if (onDataRefresh) onDataRefresh();
      postMessage('refresh');
      return { success: true, message: `${orderIds.length} orders assigned successfully.` };
    } catch (err) {
      console.error('Bulk assign failed:', err);
      return { 
        success: false, 
        message: err.response?.data?.error || 'Failed to bulk assign orders.' 
      };
    }
  }, [onDataRefresh, postMessage]);

  return { 
    assignments: enrichedAssignments, 
    availableOrders, 
    handleDragEnd, 
    handleDeleteAssignment, 
    bulkAssignOrders, 
    error 
  };
};