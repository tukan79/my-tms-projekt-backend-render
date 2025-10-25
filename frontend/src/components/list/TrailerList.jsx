import React from 'react';
import api from '../../services/api.js';
import DataTable from '../shared/DataTable.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';

const TrailerList = ({ items: trailers = [], onRefresh, onEdit }) => {
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

  const { showToast } = useToast();

  const handleDelete = async (trailer) => {
    if (window.confirm(`Are you sure you want to delete trailer ${trailer.registration_plate}?`)) {
      try {
        await api.delete(`/api/trailers/${trailer.id}`);
        showToast('Trailer deleted successfully.', 'success');
        onRefresh();
      } catch (error) {
        showToast(error.response?.data?.error || 'Failed to delete trailer.', 'error');
      }
    }
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