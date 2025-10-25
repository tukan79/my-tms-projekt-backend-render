import React, { memo } from 'react';
import { Edit, Trash2, Weight, LayoutGrid as PalletIcon, Plus } from 'lucide-react';
import { Droppable } from '@hello-pangea/dnd';

const CapacityIndicator = ({ current, max, label, icon }) => {
  if (max === null || max === undefined) return null;

  const percentage = max > 0 ? (current / max) * 100 : 0;
  const isOverloaded = percentage > 100;

  return (
    <div className="capacity-indicator">
      <div className="capacity-text">
        {icon}
        <span>{label}: {current} / {max}</span>
      </div>
      <div className="capacity-bar-container">
        <div className={`capacity-bar ${isOverloaded ? 'overloaded' : ''}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
    </div>
  );
};

const PlanItRuns = ({ runs = [], onPopOut, onDelete, onEdit, handleAddNewRun, selectedDate, onDateChange, activeRunId, onRunSelect, isLoading }) => {
  const handleDelete = (event, run) => {
    event.stopPropagation(); // Zatrzymujemy propagację, aby nie aktywować onClick na rodzicu
    onDelete(run); // Przekazujemy cały obiekt run
  };

  const handleEdit = (event, run) => {
    event.stopPropagation();
    onEdit(run);
  };

  return (
    <div className="card planit-section">
      <div className="planit-section-header">
        <h3>Available Runs</h3>
        <div className="form-group" style={{ margin: 0, minWidth: '160px' }}>
          <input type="date" value={selectedDate} onChange={(e) => onDateChange(e.target.value)} />
        </div>
        <button onClick={handleAddNewRun} className="btn-primary" style={{ marginLeft: 'auto' }}>
          <Plus size={16} /> Add Run
        </button>
      </div>
      <div className="planit-list">
        {isLoading ? (
          <div className="loading" style={{ padding: '2rem' }}>Loading runs...</div>
        ) : runs.length > 0 ? (
          runs.map(run => (
            <Droppable key={run.id} droppableId={String(run.id)}>
              {(provided) => (
                <div
                  key={run.id} // KLUCZ DODANY
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`planit-list-item droppable-combination with-actions ${run.id === activeRunId ? 'active-run' : ''}`}
                  onClick={() => onRunSelect(run.id)} // Przełączanie aktywnego przejazdu
                >
                  <div className="planit-item-text">
                    <span>{run.displayText}</span>
                    {run.hasCapacity ? (
                      <div className="run-capacity-details">
                        <CapacityIndicator current={run.totalKilos} max={run.maxPayload} label="kg" icon={<Weight size={14} />} />
                        <CapacityIndicator current={run.totalSpaces} max={run.maxPallets} label="spaces" icon={<PalletIcon size={14} />} />
                      </div>
                    ) : (
                      <div className="run-stats" style={{ marginTop: '0.5rem' }}>
                        <span><Weight size={14} /> {run.totalKilos || 0} kg</span>
                        <span><PalletIcon size={14} /> {run.totalSpaces || 0} spaces</span>
                      </div>
                    )}
                  </div>
                  <div className="planit-item-actions">
                    <button
                      className="btn-icon"
                      title="Edit Run"
                      onClick={(e) => handleEdit(e, run)}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      className="btn-icon btn-danger"
                      title="Delete Run"
                      onClick={(e) => handleDelete(e, run)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))
        ) : (
          <p className="no-results-message" style={{ padding: '2rem' }}>No runs found for the selected date.</p>
        )}
      </div>
    </div>
  );
};

export default memo(PlanItRuns);