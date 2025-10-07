import React from 'react';
import api from '../services/api';
import DataTable from './DataTable';

const DriverList = ({ items: drivers = [], onRefresh, onEdit, onDelete }) => {
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

  const handleDelete = (driver) => {
    onDelete(`Are you sure you want to delete the driver ${driver.first_name} ${driver.last_name}? This action cannot be undone.`, async () => {
      try {
        await api.delete(`/api/drivers/${driver.id}`);
        onRefresh(); // Odśwież listę po usunięciu
      } catch (error) {
        // Lepsza obsługa błędów: można przekazać błąd do stanu nadrzędnego i wyświetlić go w komponencie "Toast" lub "Notification"
        const errorMessage = error.response?.data?.error || 'An error occurred while deleting the driver.';
        console.error("Deletion error:", errorMessage); // Logujemy błąd, ale nie pokazujemy go bezpośrednio użytkownikowi w alercie
      }
    });
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