import React, { useMemo } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import PlanItOrders from './PlanItOrders.jsx';
import PlanItRuns from './PlanItRuns.jsx';
import PlanItAssignments from './PlanItAssignments.jsx';
import { useAssignments } from '../hooks/useAssignments.js';
import { useToast } from '../contexts/ToastContext.jsx';

const PlanItPage = ({ orders = [], runs = [], assignments: initialAssignments = [], drivers = [], trucks = [], zones = [], onAssignmentCreated, onDelete }) => {
  const { showToast } = useToast();

  // Wzbogacamy dane o przejazdach o czytelne etykiety i obliczone sumy
  const enrichedRuns = useMemo(() => {
    return runs.map(run => {
      const driver = drivers.find(d => d.id === run.driver_id);
      const truck = trucks.find(t => t.id === run.truck_id);

      // Znajdź zlecenia przypisane do tego przejazdu
      const assignedOrders = initialAssignments
        .filter(a => a.run_id === run.id)
        .map(a => orders.find(o => o.id === a.order_id))
        .filter(Boolean); // Usuń niezdefiniowane, jeśli zlecenie nie zostało znalezione

      // Oblicz sumy
      const totalKilos = assignedOrders.reduce((sum, order) => sum + (order.cargo_details?.total_kilos || 0), 0);
      const totalPallets = assignedOrders.reduce((sum, order) => {
        const palletCount = Object.values(order.cargo_details?.pallets || {}).reduce((palletSum, p) => palletSum + (Number(p.count) || 0), 0);
        return sum + palletCount;
      }, 0);

      return {
        ...run,
        displayText: `${driver ? `${driver.first_name} ${driver.last_name}` : 'No Driver'} - ${truck ? truck.registration_plate : 'No Truck'}`,
        totalKilos,
        totalPallets,
      };
    });
  }, [runs, drivers, trucks, initialAssignments, orders]);

  const { 
    assignments, 
    availableOrders, 
    handleDragEnd, 
    handleDeleteAssignment, 
    error 
  } = useAssignments({
    initialAssignments,
    orders,
    enrichedRuns,
    onDataRefresh: onAssignmentCreated
  });

  if (error) {
    showToast(error, 'error');
  }

  const handlePopOut = (view) => {
    window.open(`/planit/${view}`, `PlanIt - ${view}`, 'width=800,height=600');
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="planit-container-resizable">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', height: '100%' }}>
          <PlanItOrders 
            orders={availableOrders} 
            zones={zones}
            onPopOut={handlePopOut} 
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <PlanItRuns 
              runs={enrichedRuns} 
              onPopOut={handlePopOut} 
              onDelete={onDelete} 
            />
            <PlanItAssignments 
              assignments={assignments} 
              onPopOut={handlePopOut}
              onDeleteAssignment={handleDeleteAssignment}
            />
          </div>
        </div>
      </div>
    </DragDropContext>
  );
};

export default PlanItPage;