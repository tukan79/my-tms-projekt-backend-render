import React from 'react';
import { useApiResource } from '../hooks/useApiResource.js';
import { useToast } from '../contexts/ToastContext.jsx';
import DataTable from './DataTable';
import { Package, DollarSign, Calendar } from 'lucide-react';

const isPostcodeInZone = (postcode, zone) => {
  if (!postcode || !zone || !zone.postcode_patterns) {
    return false;
  }
  return zone.postcode_patterns.some(pattern => {
    const regexPattern = pattern.replace(/%/g, '.*');
    const regex = new RegExp(`^${regexPattern}`, 'i');
    return regex.test(postcode);
  });
};

const OrderList = ({ items: orders = [], zones = [], onRefresh, onEdit, onDelete }) => {
  const { deleteResource } = useApiResource('/api/orders', 'order');
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = React.useState('all'); // 'all', 'delivery', 'collections'
  const [dateRange, setDateRange] = React.useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  const columns = [
    { key: 'order_number', header: 'Consignment #', icon: <Package size={16} /> },
    { key: 'customer_reference', header: 'Customer Ref' },
    { 
      key: 'status', 
      header: 'Status', 
      render: (order) => <span className={`status status-${order.status}`}>{order.status}</span> 
    },
    { key: 'sender_details.name', header: 'Loading', render: (order) => (
      <div>
        <div>{order.sender_details?.name}, {order.sender_details?.townCity}</div>
        <div className="date-time">{new Date(order.loading_date_time).toLocaleString()}</div>
      </div>
    )},
    { key: 'recipient_details.name', header: 'Unloading', render: (order) => (
      <div>
        <div>{order.recipient_details?.name}, {order.recipient_details?.townCity}</div>
        <div className="date-time">{new Date(order.unloading_date_time).toLocaleString()}</div>
      </div>
    )},
    {
      key: 'final_price',
      header: 'Price',
      icon: <DollarSign size={16} />,
      render: (item) => item.final_price ? `£${parseFloat(item.final_price).toFixed(2)}` : '-',
    },
    {
      key: 'created_at',
      header: 'Created',
      icon: <Calendar size={16} />,
      render: (item) => new Date(item.created_at).toLocaleDateString(),
    },
  ];
  
  const handleDelete = (order) => {
    onDelete(`Are you sure you want to delete order ${order.customer_reference || order.id}? This action cannot be undone.`, async () => {
      try {
        await deleteResource(order.id);
        showToast('Order deleted successfully.', 'success');
        // The useApiResource hook will handle the state update
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'Connection error. Please try again.';
        showToast(`Deletion error: ${errorMessage}`, 'error');
      }
    });
  };

  const filteredOrders = React.useMemo(() => {
    let filtered = [...orders];

    // Filtrowanie po zakładkach
    const zone1 = zones.find(z => z.zone_name === 'Zone 1');
    if (activeTab === 'delivery' && zone1) {
      filtered = filtered.filter(order => isPostcodeInZone(order.recipient_details?.postCode, zone1));
    } else if (activeTab === 'collections' && zone1) {
      filtered = filtered.filter(order => !isPostcodeInZone(order.recipient_details?.postCode, zone1));
    }

    // Filtrowanie po zakresie dat
    const { start, end } = dateRange;
    if (start && end) {
      filtered = filtered.filter(order => {
        const dateField = activeTab === 'delivery' ? order.unloading_date_time : order.loading_date_time;
        if (!dateField) return false;
        const orderDate = new Date(dateField).toISOString().split('T')[0];
        return orderDate >= start && orderDate <= end;
      });
    }

    return filtered;
  }, [orders, zones, activeTab, dateRange]);

  return (
    <div className="card">
      <div className="planit-section-header" style={{ padding: '0 0 1rem 0', marginBottom: '1rem' }}>
        <div className="tabs-container">
          <button className={`tab-button ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All Orders</button>
          <button className={`tab-button ${activeTab === 'delivery' ? 'active' : ''}`} onClick={() => setActiveTab('delivery')}>Delivery</button>
          <button className={`tab-button ${activeTab === 'collections' ? 'active' : ''}`} onClick={() => setActiveTab('collections')}>Collections</button>
        </div>
        <div className="form-group" style={{ margin: '0 0 0 1rem', minWidth: '160px' }}>
          <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>From Date</label>
          <input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
        </div>
        <div className="form-group" style={{ margin: '0 0 0 1rem', minWidth: '160px' }}>
          <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>To Date</label>
          <input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
        </div>
      </div>
      <DataTable
        items={filteredOrders}
        columns={columns}
        onRefresh={onRefresh}
        onEdit={onEdit}
        onDelete={handleDelete}
        title="Order List"
        filterPlaceholder="Filter orders..."
        initialSortKey="created_at"
        filterKeys={['order_number', 'customer_reference', 'status', 'sender_details.townCity', 'recipient_details.townCity', 'sender_details.name', 'recipient_details.name']}
      />
    </div>
  );
};

export default OrderList;