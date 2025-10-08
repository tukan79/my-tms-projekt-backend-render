import React, { useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import { Package, PoundSterling, Calendar, User } from 'lucide-react';

const FinancePage = ({ orders = [], customers = [] }) => {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  const customerMap = useMemo(() => 
    new Map(customers.map(c => [c.id, c.name])), 
  [customers]);

  const formatCargoDetails = (cargo) => {
    if (!cargo || !cargo.pallets) return 'No cargo data';
    const priceBreakdown = cargo.price_breakdown || {};
    const parts = Object.entries(cargo.pallets)
      .filter(([, details]) => details.count > 0)
      .map(([type, details]) => (
        <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9em', gap: '1rem' }}>
          <span style={{ textTransform: 'capitalize' }}>{type.replace('_', ' ')}:</span>
          <strong>{details.count} x £{(priceBreakdown[type] / details.count || 0).toFixed(2)}</strong>
        </div>
      ));
    
    return parts.length > 0 ? <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>{parts}</div> : 'Empty';
  };

  const columns = [
    { 
      key: 'order_number', 
      header: 'Consignment #', 
      icon: <Package size={16} /> 
    },
    { 
      key: 'customer_name', 
      header: 'Customer', 
      icon: <User size={16} />,
      render: (order) => customerMap.get(order.customer_id) || 'Unknown'
    },
    { 
      key: 'unloading_date_time', 
      header: 'Delivery Date', 
      icon: <Calendar size={16} />,
      render: (order) => new Date(order.unloading_date_time).toLocaleDateString()
    },
    { 
      key: 'cargo_details', 
      header: 'Cargo Breakdown',
      render: (order) => formatCargoDetails(order.cargo_details)
    },
    { 
      key: 'total_kilos', 
      header: 'Total Weight (kg)',
      render: (order) => order.cargo_details?.total_kilos || 0
    },
    {
      key: 'total_spaces',
      header: 'Total Spaces',
      render: (order) => order.cargo_details?.total_spaces || 0,
    },
    {
      key: 'calculated_price',
      header: 'Calculated Price',
      icon: <PoundSterling size={16} />,
      render: (item) => item.calculated_price ? `£${parseFloat(item.calculated_price).toFixed(2)}` : '-',
    },
    {
      key: 'final_price',
      header: 'Final Price',
      icon: <PoundSterling size={16} />,
      render: (item) => item.final_price ? `£${parseFloat(item.final_price).toFixed(2)}` : '-',
    },
    // Placeholder for surcharges - can be implemented later
    {
      key: 'surcharges',
      header: 'Surcharges',
      render: () => 'N/A',
    },
  ];

  const filteredOrders = useMemo(() => {
    const { start, end } = dateRange;
    if (!start || !end) return orders;

    return orders.filter(order => {
      const deliveryDate = order.unloading_date_time;
      if (!deliveryDate) return false;
      const orderDate = new Date(deliveryDate).toISOString().split('T')[0];
      return orderDate >= start && orderDate <= end;
    });
  }, [orders, dateRange]);

  return (
    <div className="card">
      <div className="planit-section-header" style={{ padding: '0 0 1rem 0', marginBottom: '1rem' }}>
        <h3>Finance Overview</h3>
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
        filterPlaceholder="Filter by consignment or customer..."
        filterKeys={['order_number', 'customer_reference', 'recipient_details.name']}
        initialSortKey="unloading_date_time"
      />
    </div>
  );
};

export default FinancePage;