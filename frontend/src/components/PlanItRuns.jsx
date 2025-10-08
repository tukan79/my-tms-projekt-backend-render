import React from 'react';
import { ExternalLink, Trash2, Weight, LayoutGrid as PalletIcon } from 'lucide-react';
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

const PlanItRuns = ({ runs = [], onPopOut, onDelete, selectedDate, onDateChange }) => {
  const handleDelete = (run) => {
    if (window.confirm(`Are you sure you want to delete run: ${run.displayText}?`)) {
      onDelete(run); // Przekazujemy cały obiekt run
    }
  };

  return (
    <div className="card planit-section">
      <div className="planit-section-header">
        <h3>Available Runs</h3>
        <div className="form-group" style={{ margin: 0, minWidth: '160px' }}>
          <input type="date" value={selectedDate} onChange={(e) => onDateChange(e.target.value)} />
        </div>
        {/* <button className="btn-icon" title="Open in new window" onClick={() => onPopOut('runs')}>
          <ExternalLink size={16} />
        </button> */}
      </div>
      <div className="planit-list">
        {runs.map(run => (
          <Droppable key={run.id} droppableId={String(run.id)}>
            {(provided) => (
              <div
                key={run.id} // KLUCZ DODANY
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="planit-list-item droppable-combination with-actions"
              >
                <div className="planit-item-text">
                  <span>{run.displayText}</span>
                  {run.hasCapacity ? (
                    <div className="run-capacity-details">
                      <CapacityIndicator current={run.totalKilos} max={run.maxPayload} label="kg" icon={<Weight size={14} />} />
                      <CapacityIndicator current={run.totalPallets} max={run.maxPallets} label="pallets" icon={<PalletIcon size={14} />} />
                    </div>
                  ) : (
                    <div className="run-stats" style={{ marginTop: '0.5rem' }}>
                      <span><Weight size={14} /> {run.totalKilos || 0} kg</span>
                      <span><PalletIcon size={14} /> {run.totalPallets || 0} pallets</span>
                    </div>
                  )}
                </div>
                <div className="planit-item-actions">
                  <button
                    className="btn-icon btn-danger"
                    title="Delete Run"
                    onClick={() => handleDelete(run)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </div>
  );
};

export default PlanItRuns;