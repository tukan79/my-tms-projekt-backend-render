import React, { useMemo, useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import PlanItOrders from './PlanItOrders.jsx';
import PlanItRuns from './PlanItRuns.jsx';
import PlanItAssignments from './PlanItAssignments.jsx';
import { useAssignments } from '../hooks/useAssignments.js';
import { useToast } from '../contexts/ToastContext.jsx';
import api from '../services/api.js'; // Importujemy bezpośrednio instancję api

const PlanItPage = ({ orders = [], runs = [], assignments: initialAssignments = [], drivers = [], trucks = [], trailers = [], zones = [], onAssignmentCreated }) => {
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Wzbogacamy dane o przejazdach o czytelne etykiety i obliczone sumy
  const enrichedRuns = useMemo(() => {
    return runs
      .filter(run => {
        if (!run.run_date) return false;
        // Najprostsze i najbezpieczniejsze rozwiązanie: porównujemy daty jako stringi w formacie YYYY-MM-DD.
        return run.run_date.startsWith(selectedDate);
      })
      .map(run => {
      const driver = drivers.find(d => d.id === run.driver_id);
      const truck = trucks.find(t => t.id === run.truck_id);
      const trailer = run.trailer_id ? trailers.find(t => t.id === run.trailer_id) : null; // Znajdź naczepę

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
        totalPallets,
        // Dodajemy maksymalne pojemności do obiektu przejazdu
        maxPayload,
        maxPallets,
        hasCapacity, // Nowa flaga do renderowania
      };
    });
  }, [runs, drivers, trucks, trailers, initialAssignments, orders, selectedDate]);

  const handleDeleteRun = async (run) => {
    console.log('[PlanItPage] Wywołano handleDeleteRun dla przejazdu:', run);
    try {
      await api.delete(`/api/runs/${run.id}`); // Bezpośrednie wywołanie API
      showToast(`Run "${run.displayText}" deleted successfully.`, 'success');
      onAssignmentCreated(); // Odświeżamy wszystkie dane
    } catch (error) {
      showToast(error.message || 'Failed to delete run.', 'error');
    }
  };

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
              onDelete={handleDeleteRun} // Upewniamy się, że przekazujemy poprawną funkcję
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
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