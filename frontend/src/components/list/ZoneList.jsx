import React, { useState } from 'react';
import DataTable from '../shared/DataTable.jsx'; // Poprawiona ścieżka
import api from '../../services/api.js'; // Poprawiona ścieżka
import { useToast } from '../../contexts/ToastContext.jsx'; // Poprawiona ścieżka

const ZoneList = ({ items: zones = [], onRefresh, onEdit, onDelete }) => {
  const [expandedZones, setExpandedZones] = useState({});

  const toggleZoneExpansion = (zoneId) => {
    setExpandedZones(prev => ({ ...prev, [zoneId]: !prev[zoneId] }));
  };

  const columns = [
    { key: 'zone_name', header: 'Zone Name', sortable: true },
    {
      key: 'postcode_patterns',
      header: 'Postcode Patterns',
      render: (zone) => {
        const patterns = zone.postcode_patterns || [];
        const isExpanded = expandedZones[zone.id];
        const patternsToShow = isExpanded ? patterns : patterns.slice(0, 5);

        return (
          <div className="tag-container">
            {patternsToShow.map((pattern, index) => (
              <span key={index} className="tag">{pattern}</span>
            ))}
            {patterns.length > 5 && (
              <button onClick={() => toggleZoneExpansion(zone.id)} className="btn-link">
                {isExpanded ? 'Show less' : `+${patterns.length - 5} more...`}
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: 'is_home_zone',
      header: 'Home Zone',
      render: (zone) => (zone.is_home_zone ? 'Yes' : 'No'),
    },
  ];

  const { showToast } = useToast();

  const handleDelete = async (zone) => {
    if (window.confirm(`Are you sure you want to delete zone "${zone.zone_name}"?`)) {
      try {
        await api.delete(`/api/zones/${zone.id}`);
        showToast('Zone deleted successfully.', 'success');
        onRefresh();
      } catch (error) {
        showToast(error.response?.data?.error || 'Failed to delete zone.', 'error');
      }
    }
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