import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { FixedSizeList } from 'react-window';
import { usePlanIt } from '../../contexts/PlanItContext.jsx';
import { isPostcodeInZone } from '../../utils/postcode.js';

// Eksportujemy hook, aby można go było użyć w komponencie nadrzędnym
export const useHomeZone = (zones) => {
  return useMemo(() => zones.find(z => z.is_home_zone), [zones]);
};

// 3. Wydzielony komponent wiersza
const OrderRow = React.memo(({ order, index, style, columns, isSelected, onSelect, onContextMenu, onMouseEnter, onMouseLeave }) => {
  return (
    <Draggable draggableId={`order-${order.id}`} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          style={{ ...style, ...provided.draggableProps.style }}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`planit-grid-row ${isSelected ? 'highlighted-row' : ''}`}
          onClick={(e) => onSelect(e, order.id)}
          onContextMenu={(e) => onContextMenu(e, order.id)}
          onMouseEnter={(e) => onMouseEnter(e, order)}
          onMouseLeave={onMouseLeave}
          role="button"
          tabIndex={0}
          aria-selected={isSelected}
        >
          {columns.map((col, i) => (
            <div key={`${order.id}-${i}`} className="planit-grid-cell">{col.accessor(order)}</div>
          ))}
        </div>
      )}
    </Draggable>
  );
});

const PlanItOrders = ({ orders, zones = [], homeZone, onPopOut, selectedDate }) => {
  // Pobieramy stan i funkcje z kontekstu
  const { selectedOrderIds, setSelectedOrderIds, setContextMenu } = usePlanIt();

  const [activeTab, setActiveTab] = useState('delivery');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tooltip, setTooltip] = useState({
    visible: false,
    content: null,
    position: { x: 0, y: 0 },
  });

  const listContainerRef = useRef(null);

  useEffect(() => {
    if (listContainerRef.current) {
      const resizeObserver = new ResizeObserver(entries => {
        if (entries[0]) {
          const { width, height } = entries[0].contentRect;
          setSize({ width, height });
        }
      });
      resizeObserver.observe(listContainerRef.current);
      return () => resizeObserver.disconnect();
    }
    return () => setTooltip({ visible: false, content: null, position: { x: 0, y: 0 } });
  }, []);

  const allColumns = [
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

  // Poprawka: Zamiast tworzyć różne zestawy kolumn, filtrujemy `allColumns` na podstawie aktywnej zakładki.
  // To zapewnia, że wszystkie dane są dostępne, a jedynie widoczność jest kontrolowana.
  const columns = useMemo(() => {
    if (activeTab === 'delivery') {
      // Dla "Delivery" pokazujemy kolumny 0 (Consignment) i od 4 do 8 (Unloading, Weight, Spaces)
      return [allColumns[0], ...allColumns.slice(4)];
    }
    // Dla "Collections" pokazujemy kolumny od 0 do 3 (Consignment, Loading) i od 7 do 8 (Weight, Spaces)
    return [...allColumns.slice(0, 4), ...allColumns.slice(7)];
  }, [activeTab]);

  // Obliczanie sumarycznych wartości dla wagi i miejsc paletowych
  const allEnrichedOrders = useMemo(() => {
    return orders.map(order => {
      const cargo = order.cargo_details || {};
      const totalKilos = cargo.total_kilos || 0; // Używamy istniejącego pola
      const totalSpaces = cargo.total_spaces || 0; // Używamy nowego pola
      return { ...order, totalKilos, totalSpaces };
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const isDateInRange = (order) => {
        if (!selectedDate) return true; // Jeśli data nie jest wybrana, pokaż wszystko
  
        const dateField = activeTab === 'collections' ? order.loading_date_time : order.unloading_date_time;
        if (!dateField) return false;
        try {
          const orderDate = new Date(dateField).toISOString().split('T')[0]; // Normalizujemy datę zlecenia
          if (isNaN(new Date(orderDate).getTime())) return false;
          return orderDate === selectedDate; // Porównujemy z wybraną datą
        } catch (error) {
          console.warn('Invalid date format encountered during filtering:', dateField);
          return false;
        }
      };

    const dateFilteredOrders = allEnrichedOrders.filter(isDateInRange);

    if (activeTab === 'delivery') {
      if (!homeZone) return [];
      return dateFilteredOrders.filter(order => isPostcodeInZone(order.recipient_details?.postCode, homeZone));
    }
    
    if (activeTab === 'collections') {
      if (!homeZone) return allEnrichedOrders.filter(isDateInRange);
      return dateFilteredOrders.filter(order => isPostcodeInZone(order.sender_details?.postCode, homeZone))
    }
    return []; // Domyślnie zwracamy pustą tablicę, jeśli zakładka nie jest ani 'delivery', ani 'collections'
  }, [activeTab, allEnrichedOrders, homeZone, selectedDate]);

  // Używamy ref, aby przechować czas kliknięcia bez powodowania re-renderów
  const handleClick = useCallback((e, clickedOrderId) => {
    const { ctrlKey, metaKey } = e; // metaKey to Cmd na Mac

    if (ctrlKey || metaKey) {
      // Dodaj/usuń z zaznaczenia
      setSelectedOrderIds(prev =>
        prev.includes(clickedOrderId)
          ? prev.filter(id => id !== clickedOrderId)
          : [...prev, clickedOrderId]
      );
    } else {
      // Pojedyncze zaznaczenie
      setSelectedOrderIds([clickedOrderId]);
    }
  }, [setSelectedOrderIds]);

  const handleContextMenu = useCallback((e, orderId) => {
    e.preventDefault();
    if (!selectedOrderIds.includes(orderId)) setSelectedOrderIds([orderId]);
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
  }, [selectedOrderIds, setSelectedOrderIds, setContextMenu]);

  const handleMouseEnter = useCallback((e, order) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      visible: true,
      content: (
        <>
          <strong>Loading:</strong> {order.sender_details?.name || '-'}, {order.sender_details?.address1 || '-'}, {order.sender_details?.postCode || '-'}
          <br />
          <strong>Unloading:</strong> {order.recipient_details?.name || '-'}, {order.recipient_details?.address1 || '-'}, {order.recipient_details?.postCode || '-'}
        </>
      ),
      position: { x: rect.left, y: rect.bottom },
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip({ visible: false, content: null, position: { x: 0, y: 0 } });
  }, []);

  return (
    <div className="card planit-section">
      <div className="planit-section-header">
        <h3>Available Orders</h3>
        <div className="tabs-container">
          <button className={`tab-button ${activeTab === 'delivery' ? 'active' : ''}`} onClick={() => setActiveTab('delivery')}>Delivery</button>
          <button className={`tab-button ${activeTab === 'collections' ? 'active' : ''}`} onClick={() => setActiveTab('collections')}>Collections</button>
        </div>
      </div>
      <div className="planit-list planit-table-grid">
        {/* Nagłówek siatki */}
        <div className="planit-grid-header">
              {columns.map(col => <div key={col.header}>{col.header}</div>)}
        </div>
        <div className="planit-grid-body" ref={listContainerRef}>
          {size.height > 0 && (
            <Droppable
              droppableId="orders"
              mode="virtual"
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
                    <div className="planit-grid-cell">{order.order_number || order.customer_reference}</div>
                  </div>
                );
              }}
            >
              {(provided, snapshot) => (
                <FixedSizeList
                  height={size.height}
                  itemCount={filteredOrders.length}
                  itemSize={40}
                  width={size.width}
                  outerRef={provided.innerRef}
                  itemData={{ columns, orders: filteredOrders, selectedOrderIds, handleClick, handleContextMenu, handleMouseEnter, handleMouseLeave }}
                  className={snapshot.isDraggingOver ? 'is-dragging-over' : ''}
                >
                  {({ index, style, data }) => (
                    <OrderRow order={data.orders[index]} index={index} style={style} columns={data.columns} isSelected={data.selectedOrderIds.includes(data.orders[index].id)} onSelect={data.handleClick} onContextMenu={data.handleContextMenu} onMouseEnter={data.handleMouseEnter} onMouseLeave={data.handleMouseLeave} />
                  )}
                </FixedSizeList>
              )}
            </Droppable>
          )}
        </div>
        {tooltip.visible && (
          <div 
            className="tooltip"
            style={{ top: tooltip.position.y + 15, left: tooltip.position.x + 15 }}
          >
            {tooltip.content}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(PlanItOrders);