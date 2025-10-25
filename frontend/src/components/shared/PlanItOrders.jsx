import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { FixedSizeList } from 'react-window';
import { usePlanIt } from '../../contexts/PlanItContext.jsx';
import { isPostcodeInZone } from '../../utils/postcode.js'; // Path is now correct

// Eksportujemy hook, aby można go było użyć w komponencie nadrzędnym
export const useHomeZone = (zones) => {
  return useMemo(() => zones.find(z => z.is_home_zone), [zones]);
};

// 3. Wydzielony komponent wiersza
const OrderRow = React.memo(({ order, index, style, columns, isSelected, onSelect, onContextMenu, onMouseEnter, onMouseLeave }) => {
  return (
    <Draggable draggableId={String(order.id)} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          style={{ ...provided.draggableProps.style, ...style }}
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

const PlanItOrders = ({ orders, zones = [], homeZone, onPopOut }) => {
  // Pobieramy stan i funkcje z kontekstu
  const { selectedOrderIds, setSelectedOrderIds, setContextMenu } = usePlanIt();

  const [activeTab, setActiveTab] = useState('delivery');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tooltip, setTooltip] = useState({
    visible: false,
    content: null,
    position: { x: 0, y: 0 },
  });
  const [dateRange, setDateRange] = useState({
    // Poprawka: Ustaw szerszy domyślny zakres dat dla lepszego UX.
    start: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 dni temu
    end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],   // 3 dni do przodu
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
        const { start, end } = dateRange;
        if (!start || !end) return true;
  
        const dateField = activeTab === 'collections' ? order.loading_date_time : order.unloading_date_time;
        if (!dateField) return false;
        try {
          const orderDate = new Date(dateField).toISOString().split('T')[0];
          if (isNaN(new Date(orderDate).getTime())) return false;
          return orderDate >= start && orderDate <= end;
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
    return dateFilteredOrders;
  }, [activeTab, allEnrichedOrders, homeZone, dateRange]);

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
        <div className="form-group" style={{ margin: '0 0 0 1rem', minWidth: '160px' }}>
          <label style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>From Date</label>
          <input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
        </div>
        <div className="form-group" style={{ margin: '0 0 0 1rem', minWidth: '160px' }}>
          <label style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>To Date</label>
          <input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
        </div>
      </div>
      <div className="planit-list planit-table-grid">
        {/* Nagłówek siatki */}
        <div className="planit-grid-header">
              {columns.map(col => <div key={col.header}>{col.header}</div>)}
        </div>
        <div className="planit-grid-body" ref={listContainerRef}>
          <Droppable
            droppableId="orders"
            mode="virtual"
            renderClone={(provided, snapshot, rubric) => (
              <OrderRow
                order={filteredOrders[rubric.source.index]}
                index={rubric.source.index}
                style={{ margin: 0 }}
                columns={columns}
                isSelected={true}
                onSelect={() => {}}
                onContextMenu={() => {}}
                onMouseEnter={() => {}}
                onMouseLeave={() => {}}
                provided={provided}
              />
            )}
          >
            {(provided) => (
              <FixedSizeList
                height={size.height}
                itemCount={filteredOrders.length}
                itemSize={40}
                width={size.width}
                outerRef={provided.innerRef}
              >
                {({ index, style }) => {
                  const order = filteredOrders[index];
                  if (!order) return null; // Zabezpieczenie
                  return (
                    <OrderRow
                      order={order}
                      index={index}
                      style={style}
                      columns={columns}
                      isSelected={selectedOrderIds.includes(order.id)}
                      onSelect={handleClick}
                      onContextMenu={handleContextMenu}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                    />
                  );
                }}
              </FixedSizeList>
            )}
          </Droppable>
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