import React from 'react';
import api from '../services/api';
import DataTable from './DataTable';

const TrailerList = ({ items: trailers = [], onRefresh, onEdit, onDelete }) => {
  const columns = [
    { key: 'registration_plate', header: 'Trailer Code', sortable: true },
    { key: 'description', header: 'Description', sortable: true },
    { key: 'category', header: 'Category', sortable: true },
    { key: 'max_payload_kg', header: 'Payload (kg)', sortable: true },
    { key: 'max_spaces', header: 'Spaces', sortable: true },
    { key: 'length_m', header: 'Length (m)', sortable: true },
    { key: 'status', header: 'Status', sortable: true, render: (trailer) => (
      <span className={`status ${trailer.status}`}>
        {trailer.status}
      </span>
    )},
  ];

  const handleDelete = (trailer) => {
    onDelete(`Are you sure you want to delete trailer ${trailer.registration_plate}? This action cannot be undone.`, async () => {
      try {
        await api.delete(`/api/trailers/${trailer.id}`);
        onRefresh();
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'An error occurred while deleting the trailer.';
        console.error("Deletion error:", errorMessage);
      }
    });
  };
  
  return (
    <DataTable
      items={trailers || []}
      columns={columns}
      onRefresh={onRefresh}
      onEdit={onEdit}
      onDelete={handleDelete}
      title="Trailer List"
      filterPlaceholder="Filter trailers..."
      initialSortKey="registration_plate"
      filterKeys={['registration_plate', 'description', 'category', 'status']}
    />
  );
};

export default TrailerList;