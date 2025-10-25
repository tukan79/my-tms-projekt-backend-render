import React, { useState, useEffect } from 'react';
import { useApiResource } from '../hooks/useApiResource.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { Edit, Trash2, Plus, X, Download, Upload, ArrowUp, ArrowDown } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../services/api.js';
import DataImporter from './DataImporter.jsx';

const ZoneManager = ({ zones: initialZones = [], onRefresh }) => {
  const { data: zonesFromApi, createResource, updateResource } = useApiResource('/api/zones', 'zone', initialZones);
  const { showToast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [showImporter, setShowImporter] = useState(false);
  const [formData, setFormData] = useState({ zone_name: '', postcode_patterns: '', is_home_zone: false });
  
  const [zones, setZones] = useState(initialZones);
  const [sortConfig, setSortConfig] = useState({ key: 'zone_name', direction: 'ascending' });

  useEffect(() => {
    // Sortowanie stref po nazwie
    const sorted = [...zonesFromApi].sort((a, b) => {      
      const valA = a.zone_name;
      const valB = b.zone_name;

      // Używamy wyrażenia regularnego, aby wyodrębnić liczby i tekst
      const re = /(\d+)|(\D+)/g;
      const partsA = valA.match(re);
      const partsB = valB.match(re);

      // Porównujemy części, traktując liczby jako liczby, a tekst jako tekst
      for (let i = 0; i < Math.min(partsA.length, partsB.length); i++) {
        const partA = partsA[i];
        const partB = partsB[i];
        const numA = parseInt(partA, 10);
        const numB = parseInt(partB, 10);

        if (!isNaN(numA) && !isNaN(numB)) {
          if (numA !== numB) {
            return sortConfig.direction === 'ascending' ? numA - numB : numB - numA;
          }
        } else if (partA !== partB) {
          return sortConfig.direction === 'ascending' ? partA.localeCompare(partB) : partB.localeCompare(partA);
        }
      }

      // Jeśli początki są takie same, dłuższa nazwa jest "większa"
      return sortConfig.direction === 'ascending' ? partsA.length - partsB.length : partsB.length - partsA.length;
    });
    setZones(sorted);
  }, [zonesFromApi, sortConfig]);

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    if (editingZone) {
      setFormData({
        zone_name: editingZone.zone_name,
        postcode_patterns: (editingZone.postcode_patterns || []).join(', '),
        is_home_zone: editingZone.is_home_zone,
      });
      setIsFormOpen(true);
    } else {
      setFormData({ zone_name: '', postcode_patterns: '', is_home_zone: false });
    }
  }, [editingZone]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    // Automatycznie dodajemy '%' do wzorców, jeśli użytkownik go nie wpisał.
    // This makes data entry easier.
    const patterns = formData.postcode_patterns.split(',').map(p => {
      const trimmed = p.trim();
      if (trimmed && !trimmed.endsWith('%')) {
        return `${trimmed}%`;
      }
      return trimmed;
    }).filter(Boolean);

    // Usuwamy duplikaty, aby zapewnić czystość danych.
    // We remove duplicates to ensure data cleanliness.
    const uniquePatterns = [...new Set(patterns)];
    const payload = { ...formData, postcode_patterns: uniquePatterns };

    try {
      if (editingZone) {
        await updateResource(editingZone.id, payload);
        showToast('Zone updated successfully!', 'success');
      } else {
        await createResource(payload);
        showToast('Zone created successfully!', 'success');
      }
      setIsFormOpen(false);
      setEditingZone(null);
      if (onRefresh) onRefresh(); // Odśwież dane po zapisie
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to save zone.', 'error');
    }
  };

  const handleDelete = async (zoneId) => {
    if (window.confirm('Are you sure you want to delete this zone?')) {
    try {
      await api.delete(`/api/zones/${zoneId}`);
      showToast('Zone deleted successfully.', 'success');
      if (onRefresh) onRefresh();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to delete zone.', 'error');
    }
    }
  };

  const handleRemovePattern = async (zone, patternToRemove) => {
    const updatedPatterns = zone.postcode_patterns.filter(p => p !== patternToRemove);
    try {
      await updateResource(zone.id, { ...zone, postcode_patterns: updatedPatterns });
      showToast(`Pattern '${patternToRemove}' removed from ${zone.zone_name}.`, 'success');
      if (onRefresh) onRefresh(); // Odśwież dane po usunięciu wzorca
    } catch (error) {
      showToast('Failed to remove pattern.', 'error');
    }
  };

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    // Upuszczono poza obszarem docelowym
    if (!destination) return;

    // Upuszczono w tej samej strefie
    if (source.droppableId === destination.droppableId) return;

    const sourceZoneId = parseInt(source.droppableId, 10);
    const destZoneId = parseInt(destination.droppableId, 10);
    const pattern = draggableId.split('-')[1];

    const sourceZone = zones.find(z => z.id === sourceZoneId);
    const destZone = zones.find(z => z.id === destZoneId);

    if (!sourceZone || !destZone) return;

    // Przygotowanie nowych list wzorców
    const newSourcePatterns = sourceZone.postcode_patterns.filter(p => p !== pattern);
    const newDestPatterns = [...(destZone.postcode_patterns || []), pattern];

    try {
      // Aktualizujemy obie strefy. Używamy Promise.all, aby wykonać operacje równolegle.
      await Promise.all([
        updateResource(sourceZone.id, { ...sourceZone, postcode_patterns: newSourcePatterns }),
        updateResource(destZone.id, { ...destZone, postcode_patterns: [...new Set(newDestPatterns)] }) // Usuwamy duplikaty w strefie docelowej
      ]);
      showToast(`Moved '${pattern}' from ${sourceZone.zone_name} to ${destZone.zone_name}.`, 'success');
      if (onRefresh) onRefresh(); // Odśwież dane po przeniesieniu
    } catch (error) {
      showToast('Failed to move pattern.', 'error');
      // W przypadku błędu, dane zostaną automatycznie odświeżone przez hook `useApiResource`, przywracając poprzedni stan.
    }
  };

  const handleExport = async () => {
    try {
      // Teraz oczekujemy odpowiedzi JSON z potwierdzeniem
      const response = await api.get('/api/zones/export');
      showToast(response.data.message || 'Export successful!', 'success');
    } catch (error) {
      // Błąd będzie teraz w standardowym formacie JSON
      const errorMessage = error.response?.data?.error || 'Failed to export zones.';
      showToast(errorMessage, 'error');
    }
  };

  const importerConfig = {
    title: 'Import Postcode Zones',
    apiEndpoint: '/api/zones/import',
    postDataKey: 'zones', // Backend oczekuje obiektu { zones: [...] }
    dataMappingFn: (row) => ({
      zone_name: row.zone_name,
      postcode_patterns: row.postcode_patterns, // Przekazujemy jako string, backend sobie poradzi
      is_home_zone: ['true', '1', 'yes'].includes((row.is_home_zone || '').toLowerCase()),
    }),
    previewColumns: [
      { key: 'zone_name', header: 'Zone Name' },
      { key: 'postcode_patterns', header: 'Postcode Patterns (sample)' },
      { key: 'is_home_zone', header: 'Home Zone', render: (item) => (item.is_home_zone ? 'Yes' : 'No') },
    ],
  };

  const handleImportSuccess = () => {
    setShowImporter(false);
    if (onRefresh) {
      onRefresh();
    }
    showToast('Zones imported successfully!', 'success');
  };

  return (
    <div className="data-table-container">
      <h4>Postcode Zones</h4>
      {!isFormOpen && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <button onClick={() => setIsFormOpen(true)} className="btn-primary">
            <Plus size={16} /> Add New Zone
          </button>
          <button onClick={handleExport} className="btn-secondary">
            <Download size={16} /> Export
          </button>
          <button onClick={() => setShowImporter(true)} className="btn-secondary">
            <Upload size={16} /> Import
          </button>
        </div>
      )}

      {showImporter && (
        <DataImporter
          {...importerConfig}
          onSuccess={handleImportSuccess}
          onCancel={() => setShowImporter(false)}
        />
      )}

      {isFormOpen && (
        <form onSubmit={handleFormSubmit} className="form" style={{ marginBottom: '2rem', border: '1px solid #eee', padding: '1rem', borderRadius: '8px' }}>
          <h5>{editingZone ? 'Edit Zone' : 'Add New Zone'}</h5>
          <div className="form-group">
            <label>Zone Name</label>
            <input type="text" value={formData.zone_name} onChange={e => setFormData({...formData, zone_name: e.target.value})} required />
          </div>
          <div className="form-group">
            <label>Postcode Patterns (comma-separated, e.g., SW1, W1A, WC2)</label>
            <textarea value={formData.postcode_patterns} onChange={e => setFormData({...formData, postcode_patterns: e.target.value})} rows="3" />
          </div>
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" id="is_home_zone" checked={formData.is_home_zone} onChange={e => setFormData({...formData, is_home_zone: e.target.checked})} />
            <label htmlFor="is_home_zone" style={{ marginBottom: 0 }}>This is a home zone (for this depot)</label>
          </div>
          <div className="form-actions">
            <button type="button" onClick={() => { setIsFormOpen(false); setEditingZone(null); }} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Save Zone</button>
          </div>
        </form>
      )}

      <div className="table-wrapper">
        <DragDropContext onDragEnd={onDragEnd}>
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('zone_name')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Zone Name
                    {sortConfig.key === 'zone_name' && (
                      sortConfig.direction === 'ascending' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    )}
                  </div>
                </th>
                <th>Home Zone?</th>
                <th>Postcode Patterns</th>
                <th>Actions</th>
              </tr>
            </thead>
            {zones.map(zone => (
              <Droppable key={zone.id} droppableId={String(zone.id)}>
                {(provided, snapshot) => (
                  <tbody ref={provided.innerRef} {...provided.droppableProps} style={{ backgroundColor: snapshot.isDraggingOver ? '#e6f7ff' : 'transparent' }}>
                    <tr key={zone.id}>
                      <td style={{ width: '80px' }}>{zone.zone_name}</td>
                      <td>{zone.is_home_zone ? 'Yes' : 'No'}</td>
                      <td className="tag-cell">
                        <div className="tag-container">
                          {(zone.postcode_patterns || []).map((pattern, index) => (
                            <Draggable key={`${zone.id}-${pattern}`} draggableId={`${zone.id}-${pattern}`} index={index}>
                              {(provided) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                  <span className="tag draggable-tag">
                                    {pattern}
                                    <button onClick={() => handleRemovePattern(zone, pattern)} className="tag-remove-btn"><X size={12} /></button>
                                  </span>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      </td>
                      <td className="actions-cell">
                        <button onClick={() => setEditingZone(zone)} className="btn-icon"><Edit size={16} /></button>
                        <button onClick={() => handleDelete(zone.id)} className="btn-icon btn-danger" title="Delete Zone"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  </tbody>
                )}
              </Droppable>
            ))}
          </table>
        </DragDropContext>
      </div>
    </div>
  );
};

export default ZoneManager;