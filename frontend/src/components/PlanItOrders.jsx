import React, { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Droppable, Draggable } from '@hello-pangea/dnd';

const isPostcodeInZone = (postcode, zone) => {
  if (!postcode || !zone || !zone.postcode_patterns) {
    return false;
  }
  // Sprawdza, czy kod pocztowy pasuje do któregokolwiek wzorca w strefie
  return zone.postcode_patterns.some(pattern => {
    const regexPattern = pattern.replace(/%/g, '.*');
    const regex = new RegExp(`^${regexPattern}`, 'i');
    return regex.test(postcode);
  });
};

const PlanItOrders = ({ orders, zones = [], onPopOut }) => {
  const [activeTab, setActiveTab] = useState('delivery');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [tooltip, setTooltip] = useState({
    visible: false,
    content: null,
    position: { x: 0, y: 0 },
  });
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

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

  // Uproszczone kolumny dla zakładki "Collections"
  const collectionColumns = allColumns.slice(0, 4).concat(allColumns.slice(7, 9));

  // Uproszczone kolumny dla zakładki "Delivery"
  const deliveryColumns = [allColumns[0], ...allColumns.slice(4, 9)];

  const columns = activeTab === 'delivery' ? deliveryColumns : collectionColumns;

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
    // Helper do sprawdzania, czy data zlecenia mieści się w zakresie
    const isDateInRange = (order) => {
      const { start, end } = dateRange;
      if (!start || !end) return true; // Jeśli zakres nie jest kompletny, pokaż wszystko

      const dateField = activeTab === 'delivery' ? order.unloading_date_time : order.loading_date_time;
      if (!dateField) return false;

      const orderDate = new Date(dateField).toISOString().split('T')[0];
      return orderDate >= start && orderDate <= end;
    };

    const zone1 = zones.find(z => z.zone_name === 'Zone 1');
    if (activeTab === 'delivery') {
      if (!zone1) return []; // Jeśli nie ma Strefy 1, zakładka Delivery jest pusta
      return allEnrichedOrders.filter(order => 
        isPostcodeInZone(order.recipient_details?.postCode, zone1) && isDateInRange(order)
      );
    }
    if (activeTab === 'collections') {
      if (!zone1) return allEnrichedOrders.filter(isDateInRange); // Jeśli nie ma Strefy 1, pokaż wszystko z danego dnia
      return allEnrichedOrders.filter(order => 
        !isPostcodeInZone(order.recipient_details?.postCode, zone1) && isDateInRange(order)
      );
    }
    return allEnrichedOrders;
  }, [activeTab, allEnrichedOrders, zones, dateRange]);

  // Używamy ref, aby przechować czas kliknięcia bez powodowania re-renderów
  const mouseDownTimeRef = React.useRef(0);

  const handleMouseDown = () => {
    mouseDownTimeRef.current = Date.now();
  };

  const handleMouseUp = (orderId) => {
    const timePressed = Date.now() - mouseDownTimeRef.current;
    // Uznajemy za kliknięcie, jeśli czas wciśnięcia jest krótszy niż 200ms
    if (timePressed < 200) {
      setSelectedOrderId(prevId => (prevId === orderId ? null : orderId));
    }
  };

  const handleMouseEnter = (e, order) => {
    setTooltip({
      visible: true,
      content: (
        <>
          <strong>Loading:</strong> {order.sender_details.name}, {order.sender_details.address1}, {order.sender_details.postCode}
          <br />
          <strong>Unloading:</strong> {order.recipient_details.name}, {order.recipient_details.address1}, {order.recipient_details.postCode}
        </>
      ),
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleMouseLeave = () => {
    setTooltip({ visible: false, content: null, position: { x: 0, y: 0 } });
  };

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
        <Droppable droppableId="orders">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="planit-grid-body">
              {filteredOrders.map((order, index) => (
                <Draggable key={order.id} draggableId={String(order.id)} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`planit-grid-row ${selectedOrderId === order.id ? 'highlighted-row' : ''}`}
                      onMouseDown={handleMouseDown}
                      onMouseUp={() => handleMouseUp(order.id)}
                      onMouseEnter={(e) => handleMouseEnter(e, order)}
                      onMouseLeave={handleMouseLeave}
                    >
                      {columns.map((col, i) => (
                        <div key={`${order.id}-${i}`} className="planit-grid-cell">{col.accessor(order)}</div>
                      ))}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
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

export default PlanItOrders;