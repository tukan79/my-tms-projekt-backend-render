import React, { useMemo, useCallback } from 'react';
import { useApiResource } from './useApiResource';
import { useBroadcastChannel } from './useBroadcastChannel';

/**
 * Custom hook to manage assignment logic for the PlanIt page.
 * @param {{ initialAssignments: Array, orders: Array, enrichedRuns: Array, onDataRefresh: Function }} props
 * @returns {{ assignments: Array, availableOrders: Array, handleDragEnd: Function, handleDeleteAssignment: Function, error: string|null }}
 */
export const useAssignments = ({ initialAssignments = [], orders = [], enrichedRuns = [], onDataRefresh }) => {
  const { 
    data: assignments, 
    error, 
    createResource: createAssignment, 
    deleteResource: deleteAssignment,
    setData: setAssignments 
  } = useApiResource('/api/assignments', 'assignment');

  // Sync initial assignments from props on first load or when they change.
  React.useEffect(() => {
    setAssignments(initialAssignments);
  }, [initialAssignments, setAssignments]);

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
      const orderId = parseInt(draggableId, 10);
      const runId = parseInt(destination.droppableId, 10);
      
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
    try {
      await deleteAssignment(assignmentId);
      if (onDataRefresh) onDataRefresh();
      postMessage('refresh');
    } catch (err) {
      console.error("Failed to delete assignment:", err);
    }
  }, [deleteAssignment, onDataRefresh, postMessage]);

  return { assignments: enrichedAssignments, availableOrders, handleDragEnd, handleDeleteAssignment, error };
};