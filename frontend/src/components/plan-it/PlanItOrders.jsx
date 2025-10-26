import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { usePlanIt } from '../../contexts/PlanItContext.jsx';
import { isPostcodeInZone } from '../../utils/postcode.js';

// Eksportujemy hook, aby można go było użyć w komponencie nadrzędnym
export const useHomeZone = (zones) => {
  return useMemo(() => zones.find(z => z.is_home_zone), [zones]);
};

// Wydzielony komponent wiersza
const OrderRow = React.memo(({ order, columns, isSelected, handleClick, handleContextMenu, handleMouseEnter, handleMouseLeave, index }) => {
  if (!order) return null;

  return (
    <Draggable draggableId={`order-${order.id}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{ 
            ...provided.draggableProps.style,
            backgroundColor: snapshot.isDragging ? 'var(--primary-color-light)' : 'transparent'
          }}
          className={`planit-grid-row ${isSelected ? 'highlighted-row' : ''}`}
          onClick={(e) => handleClick(e, order.id)}
          onContextMenu={(e) => handleContextMenu(e, order.id)}
          onMouseEnter={(e) => handleMouseEnter(e, order)}
          onMouseLeave={handleMouseLeave}
          role="button"
          tabIndex={0}
          aria-selected={isSelected}
          aria-label={`Order ${order.order_number || order.customer_reference || order.id}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick(e, order.id);
            }
          }}
        >
          {columns.map((col, i) => (
            <div key={`${order.id}-${i}`} className="planit-grid-cell">
              {col.accessor(order)}
            </div>
          ))}
        </div>
      )}
    </Draggable>
  );
});

OrderRow.displayName = 'OrderRow';

/**
 * Custom hook to manage filtering and enrichment of orders.
 */
const useFilteredOrders = ({ orders, activeTab, selectedDate, homeZone }) => {
  const allEnrichedOrders = useMemo(() => {
    return orders.map(order => ({
      ...order,
      totalKilos: order.cargo_details?.total_kilos || 0,
      totalSpaces: order.cargo_details?.total_spaces || 0,
    }));
  }, [orders]);

  return useMemo(() => {
    const dateFiltered = allEnrichedOrders.filter(order => {
      if (!selectedDate) return true;
      const dateField = activeTab === 'collections' ? order.loading_date_time : order.unloading_date_time;
      if (!dateField) return false;
      try {
        const orderDate = new Date(dateField).toISOString().split('T')[0];
        return orderDate === selectedDate;
      } catch {
        return false;
      }
    });

    if (!homeZone) return activeTab === 'delivery' ? [] : dateFiltered;

    return dateFiltered.filter(order => 
      isPostcodeInZone(
        activeTab === 'collections' ? order.sender_details?.postCode : order.recipient_details?.postCode, 
        homeZone
      )
    );
  }, [activeTab, allEnrichedOrders, homeZone, selectedDate]);
};

/**
 * Custom hook to manage tooltip state and positioning.
 */
const useTooltip = () => {
  const [tooltip, setTooltip] = useState({ visible: false, content: null, position: { x: 0, y: 0 } });

  const showTooltip = useCallback((e, content) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      visible: true,
      content,
      position: { x: rect.left + window.scrollX, y: rect.bottom + window.scrollY },
    });
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltip(prev => prev.visible ? { visible: false, content: null, position: { x: 0, y: 0 } } : prev);
  }, []);

  return { tooltip, showTooltip, hideTooltip };
};

// Define columns
const ALL_COLUMNS = [
  { header: 'Consignment #', accessor: (order) => order.order_number || order.customer_reference || `ID: ${order.id}` },
  { header: 'Loading Company', accessor: (order) => order.sender_details?.name || '-' },
  { header: 'Loading Address', accessor: (order) => order.sender_details?.address1 || '-' },
  { header: 'Loading PC', accessor: (order) => order.sender_details?.postCode || '-' },
  { header: 'Unloading Company', accessor: (order) => order.recipient_details?.name || '-' },
  { header: 'Unloading Address', accessor: (order) => order.recipient_details?.address1 || '-' },
  { header: 'Unloading PC', accessor: (order) => order.recipient_details?.postCode || '-' },
  { header: 'Weight', accessor: (order) => order.totalKilos > 0 ? order.totalKilos : '-' },
  { header: 'Spaces', accessor: (order) => order.totalSpaces > 0 ? order.totalSpaces : '-' },
];

const PlanItOrders = ({ orders, homeZone, selectedDate }) => {
  const { selectedOrderIds, setSelectedOrderIds, setContextMenu } = usePlanIt();

  const [activeTab, setActiveTab] = useState('delivery');
  const { tooltip, showTooltip, hideTooltip } = useTooltip();

  const COL_INDEX = {
    CONSIGNMENT: 0,
    LOADING_COMPANY: 1,
    LOADING_ADDRESS: 2,
    LOADING_PC: 3,
    UNLOADING_COMPANY: 4,
  };

  const columns = useMemo(() => {
    if (activeTab === 'delivery') {
      return [ALL_COLUMNS[COL_INDEX.CONSIGNMENT], ...ALL_COLUMNS.slice(COL_INDEX.UNLOADING_COMPANY)];
    }
    return [...ALL_COLUMNS.slice(0, COL_INDEX.UNLOADING_COMPANY), ...ALL_COLUMNS.slice(7)];
  }, [activeTab]);

  const filteredOrders = useFilteredOrders({ orders, activeTab, selectedDate, homeZone });

  const handleClick = useCallback((e, clickedOrderId) => {
    const { ctrlKey, metaKey } = e;

    if (ctrlKey || metaKey) {
      setSelectedOrderIds(prev =>
        prev.includes(clickedOrderId)
          ? prev.filter(id => id !== clickedOrderId)
          : [...prev, clickedOrderId]
      );
    } else {
      setSelectedOrderIds([clickedOrderId]);
    }
  }, [setSelectedOrderIds]);

  const handleContextMenu = useCallback((e, orderId) => {
    e.preventDefault();
    if (!selectedOrderIds.includes(orderId)) setSelectedOrderIds([orderId]);
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
  }, [selectedOrderIds, setContextMenu, setSelectedOrderIds]);

  const handleMouseEnter = useCallback((e, order) => showTooltip(e, (
    <>
      <strong>Loading:</strong> {order.sender_details?.name || '-'}, {order.sender_details?.address1 || '-'}, {order.sender_details?.postCode || '-'}
      <br />
      <strong>Unloading:</strong> {order.recipient_details?.name || '-'}, {order.recipient_details?.address1 || '-'}, {order.recipient_details?.postCode || '-'}
    </>
  )), [showTooltip]);

  const handleMouseLeave = useCallback(() => {
    hideTooltip();
  }, [hideTooltip]);

  return (
    <div className="card planit-section">
      <div className="planit-section-header">
        <h3>Available Orders</h3>
        <div className="tabs-container">
          <button 
            className={`tab-button ${activeTab === 'delivery' ? 'active' : ''}`} 
            onClick={() => setActiveTab('delivery')}
          >
            Delivery
          </button>
          <button 
            className={`tab-button ${activeTab === 'collections' ? 'active' : ''}`} 
            onClick={() => setActiveTab('collections')}
          >
            Collections
          </button>
        </div>
      </div>
      <div className="planit-list planit-table-grid">
        <div className="planit-grid-header">
          {columns.map(col => (
            <div key={col.header}>{col.header}</div>
          ))}
        </div>
        <div className="planit-grid-body">
          {filteredOrders.length > 0 ? (
            <Droppable
              droppableId="orders"
              renderClone={(provided, snapshot, rubric) => {
                const order = filteredOrders[rubric.source.index];
                if (!order) return null;
                return (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={{
                      ...provided.draggableProps.style,
                      margin: 0,
                      background: 'var(--primary-color-dark)',
                      color: 'white',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '4px',
                    }}
                    className="planit-grid-row"
                  >
                    <div className="planit-grid-cell">
                      {order.order_number || order.customer_reference}
                    </div>
                  </div>
                );
              }}
            >
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={snapshot.isDraggingOver ? 'is-dragging-over' : ''}
                  style={{ minHeight: '200px' }}
                >
                  {filteredOrders.map((order, index) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      columns={columns}
                      isSelected={selectedOrderIds.includes(order.id)}
                      handleClick={handleClick}
                      handleContextMenu={handleContextMenu}
                      handleMouseEnter={handleMouseEnter}
                      handleMouseLeave={handleMouseLeave}
                      index={index}
                    />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ) : (
            <div className="planit-empty-state">
              No orders available for the selected criteria.
            </div>
          )}
        </div>
        {tooltip.visible && (
          <div 
            className="tooltip"
            style={{ 
              top: `${tooltip.position.y + 15}px`, 
              left: `${tooltip.position.x + 15}px` 
            }}
          >
            {tooltip.content}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(PlanItOrders);