// plik TruckList.jsx

import React from 'react';
import api from '../../services/api.js';
import DataTable from '../shared/DataTable.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';

const TruckList = ({ items: trucks = [], onRefresh, onEdit }) => {
  const columns = [
    { key: 'registration_plate', header: 'Registration', sortable: true },
    { key: 'brand', header: 'Brand', sortable: true },
    { key: 'model', header: 'Model', sortable: true },
    { key: 'vin', header: 'VIN', sortable: true },
    { key: 'production_year', header: 'Year', sortable: true },
    { key: 'type_of_truck', header: 'Vehicle Type', sortable: true },
    { key: 'total_weight', header: 'Total Weight (kg)', sortable: true, render: (truck) => truck.type_of_truck === 'rigid' && truck.total_weight ? `${truck.total_weight} kg` : '-' },
    { key: 'pallet_capacity', header: 'Pallet Capacity', sortable: true, render: (truck) => truck.type_of_truck === 'rigid' && truck.pallet_capacity ? truck.pallet_capacity : '-' },
    { key: 'max_payload_kg', header: 'Payload (kg)', sortable: true, render: (truck) => truck.type_of_truck === 'rigid' && truck.max_payload_kg ? `${truck.max_payload_kg} kg` : '-' },
  ];

  const { showToast } = useToast();

  const handleDelete = async (truck) => {
    if (window.confirm(`Are you sure you want to delete vehicle ${truck.registration_plate}?`)) {
      try {
        await api.delete(`/api/trucks/${truck.id}`);
        showToast('Vehicle deleted successfully.', 'success');
        onRefresh();
      } catch (error) {
        showToast(error.response?.data?.error || 'Failed to delete vehicle.', 'error');
      }
    }
  };

  return (
    <DataTable
      items={trucks || []}
      columns={columns}
      onRefresh={onRefresh}
      onEdit={onEdit}
      onDelete={handleDelete}
      title="Vehicle List"
      filterPlaceholder="Filter vehicles..."
      initialSortKey="registration_plate"
      filterKeys={['registration_plate', 'brand', 'model', 'vin', 'type_of_truck']}
    />
  );
};

export default TruckList;