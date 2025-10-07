import React from 'react';
import { ExternalLink, Trash2, Weight, LayoutGrid as PalletIcon } from 'lucide-react';
import { Droppable } from '@hello-pangea/dnd';

const PlanItRuns = ({ runs = [], onPopOut, onDelete }) => {
  return (
    <div className="card planit-section">
      <div className="planit-section-header">
        <h3>Available Runs</h3>
        <button className="btn-icon" title="Open in new window" onClick={() => onPopOut('runs')}>
          <ExternalLink size={16} />
        </button>
      </div>
      <div className="planit-list">
        {runs.map(run => (
          <Droppable key={run.id} droppableId={String(run.id)}>
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="planit-list-item droppable-combination with-actions">
                <div className="planit-item-text">
                  <span>{run.displayText}</span>
                  <div className="run-stats">
                    <span><Weight size={14} /> {run.totalKilos || 0} kg</span>
                    <span><PalletIcon size={14} /> {run.totalPallets || 0} pallets</span>
                  </div>
                </div>
                <div className="planit-item-actions">
                  <button className="btn-icon btn-danger" title="Delete Run" onClick={() => onDelete(run)}><Trash2 size={16} /></button>
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