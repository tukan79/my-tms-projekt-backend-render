import React from 'react';
import api from '../../services/api.js';
import DataTable from '../shared/DataTable.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';

const DriverList = ({ items: drivers = [], onRefresh, onEdit }) => {
  const columns = [
    { key: 'first_name', header: 'Name', sortable: true, render: (driver) => `${driver.first_name} ${driver.last_name}` },
    { key: 'license_number', header: 'Driver\'s License', sortable: true },
    { key: 'phone_number', header: 'Phone', sortable: true },
    { key: 'cpc_number', header: 'CPC', sortable: true, render: (driver) => driver.cpc_number || 'N/A' },
    { key: 'login_code', header: 'Login Code', sortable: true, render: (driver) => driver.login_code || 'N/A' },
    { key: 'is_active', header: 'Status', sortable: true, render: (driver) => (
      <span className={`status ${driver.is_active ? 'active' : 'inactive'}`}>
        {driver.is_active ? 'Active' : 'Inactive'}
      </span>
    )},
  ];

  const { showToast } = useToast();

  const handleDelete = async (driver) => {
    if (window.confirm(`Are you sure you want to delete driver ${driver.first_name} ${driver.last_name}?`)) {
      try {
        await api.delete(`/api/drivers/${driver.id}`);
        showToast('Driver deleted successfully.', 'success');
        onRefresh();
      } catch (error) {
        showToast(error.response?.data?.error || 'Failed to delete driver.', 'error');
      }
    }
  };

  return (
    <DataTable
      items={drivers || []}
      columns={columns}
      onRefresh={onRefresh}
      onEdit={onEdit}
      onDelete={handleDelete}
      title="Driver List"
      filterPlaceholder="Filter drivers..."
      initialSortKey="first_name"
      filterKeys={['first_name', 'last_name', 'license_number', 'cpc_number', 'login_code']}
    />
  );
};

export default DriverList;