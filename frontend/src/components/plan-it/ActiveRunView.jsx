import React, { memo } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { X, Trash2, Weight, LayoutGrid as PalletIcon, Play, CheckCircle, ArrowDownToLine, ArrowUpFromLine, FileText } from 'lucide-react';
import api from '@/services/api.js';
import { useToast } from '@/contexts/ToastContext.jsx';
import { isPostcodeInZone } from '@/utils/postcode.js';

const CapacityIndicator = ({ current, max, label, icon }) => {
  // Zabezpieczenie przed wartościami null, undefined i nieliczbowymi
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safeMax = Number.isFinite(max) ? max : 0;
  if (safeMax === null || safeMax === undefined) return null;
  const percentage = safeMax > 0 ? (safeCurrent / safeMax) * 100 : 0;
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

const ActiveRunView = ({ run, assignedOrders = [], onDeselect, onDeleteAssignment, homeZone, triggerRefresh }) => {
  if (!run) return null;

  const { showToast } = useToast();
  // Usunięto hook usePlanIt, triggerRefresh jest teraz przekazywany jako prop
  const [isBusy, setIsBusy] = React.useState(false);

  // Mapa statusów dla lepszej czytelności i zarządzania
  const STATUS_META = {
    planned: { label: 'Planned', className: 'status-planned' },
    in_progress: { label: 'In Progress', className: 'status-in_progress' },
    completed: { label: 'Completed', className: 'status-completed' },
  };
  const statusMeta = STATUS_META[run.status] ?? { label: run.status.replace(/_/g, ' '), className: `status-${run.status}` };

  const handleStatusChange = async (newStatus) => {
    setIsBusy(true);
    try {
      await api.patch(`/api/runs/${run.id}/status`, { status: newStatus });
      showToast(`Run status updated to "${newStatus.replace('_', ' ')}".`, 'success');
      // Używamy triggerRefresh z kontekstu, aby odświeżyć dane globalnie
      triggerRefresh();
    } catch (error) {
      console.error("Failed to update run status:", error);
      const msg = error.response?.data?.message || 'Failed to update run status.';
      showToast(msg, 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const handleGenerateManifest = async () => {
    try {
      const response = await api.get(`/api/runs/${run.id}/manifest`, {
        responseType: 'blob', // Ważne, aby otrzymać plik
      });
      // Dodajemy typ MIME dla pewności
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `manifest_run_${run.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('Manifest generated successfully!', 'success');
    } catch (error) {
      console.error("Failed to generate manifest:", error);
      const msg = error.response?.data?.message || 'Failed to generate manifest.';
      showToast(msg, 'error');
    }
  };

  return (
    <div className="card planit-section active-run-view">
      <div className="planit-section-header">
        <h3>{run.displayText}</h3>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className={`status ${statusMeta.className}`}>{statusMeta.label}</span>
          <button
            type="button"
            className="btn-icon"
            title="Close View"
            aria-label="Close view"
            onClick={onDeselect}
            style={{ marginLeft: '1rem' }}
          ><X size={18} /></button>
        </div>
      </div>

      <div className="run-capacity-details" style={{ padding: '0 1rem 1rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
        {run.hasCapacity ? (
          <>
            <CapacityIndicator current={run.totalKilos} max={run.maxPayload} label="kg" icon={<Weight size={14} />} />
            <CapacityIndicator current={run.totalSpaces} max={run.maxPallets} label="spaces" icon={<PalletIcon size={14} />} />
          </>
        ) : (
          <div className="run-stats">
            <span><Weight size={14} /> {run.totalKilos || 0} kg</span>
            <span><PalletIcon size={14} /> {run.totalSpaces || 0} spaces</span>
          </div>
        )}
      </div>
      
      <div className="form-actions" style={{ padding: '1rem', justifyContent: 'center' }}>
        {run.status === 'planned' && (
          <button type="button" onClick={() => handleStatusChange('in_progress')} className="btn-primary">
            <Play size={16} /> Start Run
          </button>
        )}
        {run.status === 'in_progress' && (
          <button type="button" onClick={() => handleStatusChange('completed')} className="btn-primary">
            <CheckCircle size={16} /> Complete Run
          </button>
        )}
        {(run.status === 'in_progress' || run.status === 'completed') && (
          <button type="button" onClick={handleGenerateManifest} className="btn-secondary" aria-label="Download manifest"><FileText size={16} /> Download Manifest</button>
        )}
      </div>

      <div className="planit-list-wrapper">
        <Droppable droppableId={`run-active-${run.id}`}>
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="planit-list">
              {assignedOrders.map((order, index) => {
                const isDelivery = isPostcodeInZone(order.recipient_details?.postCode, homeZone);
                const operationType = isDelivery ? 'delivery' : 'collection';

                return (
                  <Draggable key={`assigned-order-${order.id}`} draggableId={`assigned-order-${order.id}`} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className="planit-list-item with-actions" style={{ position: 'relative', paddingLeft: '1.5rem' }}
                    >
                      <div className={`op-type-indicator ${operationType}`} />
                      <div className="planit-item-text" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexGrow: 1 }}>
                        <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {operationType === 'delivery' ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
                          {order.order_number || order.customer_reference}
                        </strong>
                        <div style={{ fontSize: '0.85em', color: 'var(--text-muted-color)' }}>
                          {(() => {
                            const details = operationType === 'delivery' ? order.recipient_details : order.sender_details;
                            return <span>{details?.name ?? '—'}, {details?.address1 ?? '—'}, {details?.postCode ?? '—'}</span>;
                          })()}
                        </div>
                        <div className="run-stats" style={{ fontSize: '0.85em', gap: '1rem' }}>
                          <span><Weight size={12} /> {order.cargo_details?.total_kilos || 0} kg</span>
                          <span><PalletIcon size={12} /> {order.cargo_details?.total_spaces || 0} spaces</span>
                        </div>
                      </div>
                      <div className="planit-item-actions">
                        <button
                          type="button"
                          className="btn-icon btn-danger"
                          title="Unassign Order"
                          aria-label="Unassign order"
                          onClick={() => onDeleteAssignment(order.assignmentId)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    </div>
  );
};

export default memo(ActiveRunView);