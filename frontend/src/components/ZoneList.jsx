import React from 'react';
import DataTable from './DataTable.jsx';
import api from '../services/api.js';

const ZoneList = ({ items: zones = [], onRefresh, onEdit, onDelete }) => {
  const columns = [
    { key: 'zone_name', header: 'Zone Name', sortable: true },
    {
      key: 'postcode_patterns',
      header: 'Postcode Patterns',
      render: (zone) => (
        <div className="tag-container">
          {(zone.postcode_patterns || []).map((pattern, index) => (
            <span key={index} className="tag">{pattern}</span>
          ))}
        </div>
      ),
    },
    {
      key: 'is_home_zone',
      header: 'Home Zone',
      render: (zone) => (zone.is_home_zone ? 'Yes' : 'No'),
    },
  ];

  const handleDelete = (zone) => {
    onDelete(`Are you sure you want to delete zone "${zone.zone_name}"?`, async () => {
      await api.delete(`/api/zones/${zone.id}`);
    });
  };

  return (
    <DataTable
      items={zones}
      columns={columns}
      onRefresh={onRefresh}
      onEdit={onEdit}
      onDelete={handleDelete}
      title="Postcode Zones"
      filterPlaceholder="Filter zones..."
      filterKeys={['zone_name', 'postcode_patterns']}
    />
  );
};

export default ZoneList;