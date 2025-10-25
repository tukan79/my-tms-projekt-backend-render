import React, { useMemo, useState } from 'react';
import DataTable from '../components/shared/DataTable.jsx';
import { Package, PoundSterling, Calendar, Download, FileText } from 'lucide-react';
import api from '../services/api.js';
import { useToast } from '../contexts/ToastContext.jsx';
import InvoiceList from '../components/list/InvoiceList.jsx'; // Ścieżka jest już poprawna

const FinancePage = ({ orders = [], customers = [], surcharges: surchargeTypes = [], invoices = [], onEdit, onRefresh, invoiceActions }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    selectedOrder: null,
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const customerMap = useMemo(() =>
    new Map(customers.map(c => [c.id, c])),
  [customers]);

  const surchargeMap = useMemo(() => 
    new Map(surchargeTypes.map(s => [s.code.toLowerCase(), s.name])),
  [surchargeTypes]);

  // Sugestia: Stwórz mapę definicji dopłat dla szybszego dostępu (O(1) zamiast O(n)).
  const surchargeDefMap = useMemo(() =>
    new Map(surchargeTypes.map(s => [s.code, s])),
  [surchargeTypes]);

  // Zamyka menu kontekstowe po kliknięciu gdziekolwiek
  React.useEffect(() => {
    const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, selectedOrder: null });
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const formatCargoDetails = (cargo) => {
    if (!cargo || !Array.isArray(cargo.pallets) || cargo.pallets.length === 0) {
      return 'No cargo data';
    }

    const priceBreakdown = cargo.price_breakdown || {};

    // Agregujemy palety tego samego typu
    const aggregatedPallets = cargo.pallets.reduce((acc, pallet) => {
      acc[pallet.type] = (acc[pallet.type] || 0) + (Number(pallet.quantity) || 0);
      return acc;
    }, {});

    const parts = Object.entries(aggregatedPallets).map(([type, quantity]) => (
      <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9em', gap: '1rem' }}>
        <span style={{ textTransform: 'capitalize' }}>{quantity} x {type.replace('_', ' ')}:</span>
        <strong>£{(priceBreakdown[type] || 0).toFixed(2)}</strong>
      </div>
    ));

    return parts.length > 0 ? <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>{parts}</div> : 'Empty';
  };

  const columns = [
    {
      key: 'customer_code',
      header: 'Customer Code',
      sortable: true,
      render: (order) => customerMap.get(order.customer_id)?.customer_code || 'N/A',
    },
    { 
      key: 'order_number', 
      header: 'Consignment #', 
      icon: <Package size={16} />,
      sortable: true,
    },
    {
      key: 'loading',
      header: 'Loading',
      sortable: true,
      render: (order) => (
        <div>
          <div>{order.sender_details?.name}, {order.sender_details?.townCity}</div>
          <div className="date-time">{new Date(order.loading_date_time).toLocaleString()}</div>
        </div>
      ),
      sortKey: 'loading_date_time',
    },
    {
      key: 'unloading',
      header: 'Unloading',
      sortable: true,
      render: (order) => (
        <div>
          <div>{order.recipient_details?.name}, {order.recipient_details?.townCity}</div>
          <div className="date-time">{new Date(order.unloading_date_time).toLocaleString()}</div>
        </div>
      ),
      sortKey: 'unloading_date_time',
    },
    { 
      key: 'cargo_details', 
      header: 'Cargo Breakdown',
      render: (order) => formatCargoDetails(order.cargo_details)
    },
    { 
      key: 'total_kilos', 
      header: 'Total Weight (kg)',
      render: (order) => order.cargo_details?.total_kilos || 0,
      sortable: true,
      sortKey: 'cargo_details.total_kilos',
    },
    {
      key: 'total_spaces',
      header: 'Total Spaces',
      render: (order) => order.cargo_details?.total_spaces || 0,
      sortable: true,
      sortKey: 'cargo_details.total_spaces',
    },
    {
      key: 'calculated_price',
      header: 'Calculated Price',
      icon: <PoundSterling size={16} />,
      render: (item) => item.calculated_price ? `£${parseFloat(item.calculated_price).toFixed(2)}` : '-',
      sortable: true,
    },
    {
      key: 'surcharges',
      header: 'Surcharges',
      render: (order) => {
        // Używamy `selected_surcharges` jako głównego źródła prawdy o dopłatach.
        const selectedCodes = order.selected_surcharges || [];

        const surchargeElements = selectedCodes.map((code, index) => {
          const surchargeDef = surchargeDefMap.get(code);
          // Jeśli dopłata nie istnieje lub jej kwota wynosi 0, nie renderujemy jej.
          if (!surchargeDef || parseFloat(surchargeDef.amount) <= 0) {
            return null;
          }

          const pricePerOccurrence = surchargeDef.amount;
          const methodIndicator = surchargeDef.calculation_method === 'per_order' ? 'PerC' : 'PerP';

          return (
            <div key={`${code}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9em', gap: '1rem' }}>
              <span>{code.toUpperCase()} ({methodIndicator}):</span>
              <strong>£{parseFloat(pricePerOccurrence).toFixed(2)}</strong>
            </div>
          );
        }).filter(Boolean); // Usuwamy z tablicy elementy `null`

        return surchargeElements.length > 0 ? <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>{surchargeElements}</div> : '-';
      },
    },
    {
      key: 'final_price',
      header: 'Final Price',
      icon: <PoundSterling size={16} />,
      render: (item) => item.final_price ? `£${parseFloat(item.final_price).toFixed(2)}` : '-',
      sortable: true,
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

  const totals = useMemo(() => {
    return filteredOrders.reduce(
      (acc, order) => {
        acc.totalKilos += order.cargo_details?.total_kilos || 0;
        acc.totalSpaces += order.cargo_details?.total_spaces || 0;
        acc.calculatedPrice += parseFloat(order.calculated_price) || 0;
        acc.finalPrice += parseFloat(order.final_price) || 0;
        return acc;
      },
      { totalKilos: 0, totalSpaces: 0, calculatedPrice: 0, finalPrice: 0 }
    );
  }, [filteredOrders]);

  const footerData = {
    total_kilos: totals.totalKilos.toFixed(2),
    total_spaces: totals.totalSpaces.toFixed(0),
    final_price: `£${totals.finalPrice.toFixed(2)}`,
  };

  const handleExport = () => {
    const headers = columns.map(col => col.header).join(',');

    const rows = filteredOrders.map(order => {
      return columns.map(col => {
        let value;
        if (col.render) {
          // Uproszczona logika do generowania tekstu zamiast JSX
          if (col.key === 'cargo_details' || col.key === 'surcharges') {
            const breakdown = order.cargo_details?.price_breakdown || {};
            let textParts = [];
            if (col.key === 'cargo_details') {
              textParts = Object.entries(order.cargo_details?.pallets || {})
                .filter(([, details]) => details.count > 0)
                .map(([type, details]) => `${type}: ${details.count}x${(breakdown[type] / details.count || 0).toFixed(2)}`);
            } else {
              textParts = Object.entries(breakdown)
                .filter(([key]) => !['micro', 'quarter', 'half', 'plus_half', 'full'].includes(key))
                .map(([key, val]) => `${key.toUpperCase()}: ${parseFloat(val).toFixed(2)}`);
            }
            value = textParts.join('; ');
          } else if (col.key === 'loading' || col.key === 'unloading') {
            const details = col.key === 'loading' ? order.sender_details : order.recipient_details;
            const dateTime = col.key === 'loading' ? order.loading_date_time : order.unloading_date_time;
            value = `${details?.name}, ${details?.townCity} (${new Date(dateTime).toLocaleString()})`;
          } else {
            const rendered = col.render(order);
            value = typeof rendered === 'object' ? JSON.stringify(rendered) : String(rendered).replace(/£/g, '');
          }
        } else {
          value = order[col.key];
        }
        return `"${String(value || '').replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `finance_overview_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateInvoice = async () => {
    if (!selectedCustomerId) {
      showToast('Please select a customer first.', 'warning');
      return;
    }
    try {
      await invoiceActions.create({
        customerId: selectedCustomerId,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      showToast('Invoice generated successfully!', 'success');
      // No need to call onRefresh(), useApiResource handles the state update
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to generate invoice.', 'error');
    }
  };

  const handleContextMenu = (event, order) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      selectedOrder: order,
    });
  };

  const handleEditOrder = () => {
    if (contextMenu.selectedOrder && onEdit) onEdit(contextMenu.selectedOrder);
    setContextMenu({ visible: false, x: 0, y: 0, selectedOrder: null }); // Zamknij menu po akcji
  };

  return (
    <div className="card">
      <div className="tabs-container" style={{ marginBottom: '2rem' }}>
        <button className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={`tab-button ${activeTab === 'invoices' ? 'active' : ''}`} onClick={() => setActiveTab('invoices')}>Invoices</button>
      </div>

      {activeTab === 'overview' && (
        <>
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
            <div style={{ marginLeft: 'auto' }}>
              <button onClick={handleExport} className="btn-secondary"><Download size={16} /> Export</button>
            </div>
          </div>

          <div className="planit-section-header" style={{ padding: '0 0 1rem 0', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <h4>Invoicing</h4>
            <div className="form-group" style={{ margin: '0 0 0 1rem', minWidth: '200px' }}>
              <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Customer</label>
              <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                <option value="">-- Select a customer --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ marginLeft: '1rem', alignSelf: 'flex-end' }}>
              <button onClick={handleGenerateInvoice} className="btn-primary" disabled={!selectedCustomerId}>
                <FileText size={16} /> Generate Invoice
              </button>
            </div>
          </div>

          {contextMenu.visible && (
            <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
              <button onClick={handleEditOrder}>Edit Consignment</button>
            </div>
          )}

          <DataTable
            items={filteredOrders}
            columns={columns}
            filterPlaceholder="Filter by consignment or customer..."
            filterKeys={['order_number', 'customer_reference', 'recipient_details.name']}
            initialSortKey="unloading_date_time"
            onContextMenu={handleContextMenu}
            footerData={footerData}
          />
        </>
      )}

      {activeTab === 'invoices' && <InvoiceList invoices={invoices} />}
    </div>
  );
};

export default FinancePage;