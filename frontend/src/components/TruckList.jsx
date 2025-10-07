// plik TruckList.jsx

import React from 'react';
import api from '../services/api';
import DataTable from './DataTable';

const TruckList = ({ items: trucks = [], onRefresh, onEdit, onDelete }) => {
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

  const handleDelete = (truck) => {
    onDelete(`Are you sure you want to delete vehicle ${truck.registration_plate}? This action cannot be undone.`, async () => {
      try {
        await api.delete(`/api/trucks/${truck.id}`);
        onRefresh();
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'An error occurred while deleting the vehicle.';
        console.error("Deletion error:", errorMessage);
      }
    });
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