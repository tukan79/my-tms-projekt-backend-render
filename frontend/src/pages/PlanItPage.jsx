import React, { useCallback } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import PlanItOrders, { useHomeZone } from '../components/plan-it/PlanItOrders.jsx';
import PlanItRuns from '../components/plan-it/PlanItRuns.jsx';
import { usePopOut } from '../contexts/PopOutContext.jsx'; // Ścieżka względna, więc bez zmian
import AddRunForm from '../components/forms/AddRunForm.jsx';
import { PlanItProvider, usePlanIt } from '../contexts/PlanItContext.jsx';
import ActiveRunView from '../components/plan-it/ActiveRunView.jsx';

const PlanItPage = (props) => {
  const popOutData = usePopOut();
  
  // POPRAWIONE: Poprawna logika destrukturyzacji
  const isInPopOut = Boolean(popOutData);
  const sourceData = isInPopOut ? popOutData : props;
  
  const {
    isPopOut = isInPopOut,
    ...restProps
  } = sourceData;

  const handlePopOut = useCallback((view) => {
    // Filtrujemy tylko dane, które można serializować
    const serializableData = { ...restProps };
    Object.keys(serializableData).forEach(key => {
      if (typeof serializableData[key] === 'function') {
        delete serializableData[key];
      }
    });
    
    sessionStorage.setItem('popOutData', JSON.stringify(serializableData));
    window.open(`/planit/popout`, `PlanIt View`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
  }, [restProps]);

  return (
    <PlanItProvider initialData={restProps} {...restProps}>
      <PlanItContent isPopOut={isPopOut} handlePopOut={handlePopOut} />
    </PlanItProvider>
  );
};

const PlanItContent = ({ isPopOut, handlePopOut }) => {
  const {
    selectedDate, activeRunId, editingRun, isFormVisible, selectedOrderIds, contextMenu, handleAddNewRun,
    setSelectedDate, setActiveRunId, setIsFormVisible, handleSaveRun, handleBulkAssign, handleBulkDelete, setContextMenu, triggerRefresh, handleEditRun, 
    enrichedRuns, availableOrders, activeRun, ordersForActiveRun, handleDragEnd, handleDeleteAssignment, handleDeleteRun, isLoadingRuns,
    initialData: { drivers, trucks, trailers, zones, pallets }
  } = usePlanIt();

  // Zabezpieczenie: Jeśli kluczowe dane nie są jeszcze załadowane, wyświetl komunikat.
  if (!drivers || !trucks || !trailers || !zones) {
    return <div className="loading">Loading planning data...</div>;
  }

  const homeZone = useHomeZone(zones);

  React.useEffect(() => {
    const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0 });
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [setContextMenu]);

  const handleRunSelect = useCallback((runId) => {
    setActiveRunId(currentId => (currentId === runId ? null : runId));
  }, [setActiveRunId]);

  const handleDeselectRun = useCallback(() => setActiveRunId(null), [setActiveRunId]);

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      {isFormVisible && (
        <>
          <div className="modal-backdrop" onClick={() => setIsFormVisible(false)} />
          <AddRunForm
            itemToEdit={editingRun ?? null}
            onSuccess={handleSaveRun}
            onCancel={() => setIsFormVisible(false)}
            drivers={drivers || []}
            trucks={trucks || []}
            trailers={trailers || []}
          />
        </>
      )}
      <div className="planit-container-resizable">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', height: '100%' }}>
          <PlanItOrders 
            orders={availableOrders} 
            zones={zones || []}
            homeZone={homeZone}
            selectedDate={selectedDate}
            onPopOut={handlePopOut}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
            {contextMenu.visible && (
              <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
                <button type="button" onClick={handleBulkAssign} disabled={!activeRunId} aria-label="Assign selected to active run">
                  Assign to Active Run
                </button>
                {selectedOrderIds.length > 1 && (
                  <button type="button" onClick={handleBulkDelete} className="btn-danger" aria-label={`Delete ${selectedOrderIds.length} orders`}>
                    Delete {selectedOrderIds.length} Orders
                  </button>
                )}
              </div>
            )}
            <PlanItRuns 
              runs={enrichedRuns} 
              onPopOut={handlePopOut} 
              onDelete={handleDeleteRun}
              handleAddNewRun={handleAddNewRun}
              onEdit={handleEditRun}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              activeRunId={activeRunId}
              isLoading={isLoadingRuns}
              onRunSelect={handleRunSelect}
            />
            <ActiveRunView
              run={activeRun}
              assignedOrders={ordersForActiveRun || []}
              onDeselect={handleDeselectRun}
              onDeleteAssignment={handleDeleteAssignment}
              homeZone={homeZone}
              triggerRefresh={triggerRefresh}
            />
          </div>
        </div>
      </div>
    </DragDropContext>
  );
};

export default PlanItPage;