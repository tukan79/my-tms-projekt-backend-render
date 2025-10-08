import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { Plus, Trash2, X, Edit, Save, XCircle, Download, Upload } from 'lucide-react';
import AddRateEntryForm from './AddRateEntryForm.jsx';
import DataImporter from './DataImporter.jsx'; // Używamy generycznego importera

const RateCardEditor = ({ customers = [], zones = [] }) => {
  const [rateCards, setRateCards] = useState([]);
  const [selectedRateCardId, setSelectedRateCardId] = useState('');
  const [rateEntries, setRateEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null); // Stan do śledzenia edytowanego wiersza
  const [showImporter, setShowImporter] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false); // Stan do pokazywania formularza
  const [assignedCustomers, setAssignedCustomers] = useState([]);
  const { showToast } = useToast();

  // Fetch all global rate cards on component mount
  useEffect(() => {
    const fetchRateCards = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/api/rate-cards');
        setRateCards(response.data);
      } catch (error) {
        showToast('Failed to fetch rate cards.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchRateCards();
  }, [showToast]);

  const fetchRateEntries = useCallback(async () => {
    if (!selectedRateCardId) {
      setRateEntries([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.get(`/api/rate-cards/${selectedRateCardId}/entries`);
      setRateEntries(response.data);
    } catch (error) {
      showToast('Failed to fetch rate entries.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRateCardId, showToast]);

  const fetchAssignedCustomers = useCallback(async () => {
    if (!selectedRateCardId) {
      setAssignedCustomers([]);
      return;
    }
    try {
      const response = await api.get(`/api/rate-cards/${selectedRateCardId}/customers`);
      setAssignedCustomers(response.data);
    } catch (error) {
      showToast('Failed to fetch assigned customers.', 'error');
    }
  }, [selectedRateCardId, showToast]);

  // Fetch rate entries when a rate card is selected
  useEffect(() => {
    setShowAddForm(false);
    setShowImporter(false);
    setEditingEntry(null);
    if (selectedRateCardId) {
      fetchRateEntries();
      fetchAssignedCustomers();
    }
  }, [selectedRateCardId, fetchRateEntries, fetchAssignedCustomers]);

  const handleCreateRateCard = async () => {
    const name = prompt('Enter a name for the new rate card (e.g., "Standard 2024"):');
    if (name) {
      try {
        const response = await api.post('/api/rate-cards', { name });
        setRateCards(prev => [...prev, response.data]);
        showToast('Rate card created.', 'success');
      } catch (error) {
        showToast('Failed to create rate card.', 'error');
      }
    }
  };

  const handleAssignCustomer = async (customerId) => {
    if (!selectedRateCardId || !customerId) return;
    try {
      await api.post(`/api/rate-cards/${selectedRateCardId}/customers/${customerId}`);
      fetchAssignedCustomers();
      showToast('Customer assigned successfully.', 'success');
    } catch (error) {
      showToast('Failed to assign customer.', 'error');
    }
  };

  const handleUnassignCustomer = async (customerId) => {
    if (!selectedRateCardId || !customerId) return;
    try {
      await api.delete(`/api/rate-cards/${selectedRateCardId}/customers/${customerId}`);
      fetchAssignedCustomers();
      showToast('Customer unassigned.', 'success');
    } catch (error) {
      showToast('Failed to unassign customer.', 'error');
    }
  };

  const handleCreateRateEntry = async (entryData) => {
    if (!selectedRateCardId) return;
    try {
      const response = await api.post(`/api/rate-cards/${selectedRateCardId}/entries`, entryData);
      setRateEntries(prev => [...prev, response.data]);
      setShowImporter(false);
      setShowAddForm(false);
      showToast('Rate entry added successfully!', 'success');
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to add rate entry.';
      showToast(errorMessage, 'error');
      console.error(error);
    }
  };
  
  const handleImportSuccess = () => {
    setShowImporter(false);
    fetchRateEntries(); // Bezpośrednio odświeżamy dane
  };

  const handleUpdateRateEntry = async () => {
    if (!editingEntry) return;
    try {
      const response = await api.put(`/api/rate-cards/entries/${editingEntry.id}`, editingEntry);
      setRateEntries(prev => prev.map(entry => entry.id === editingEntry.id ? response.data : entry));
      setEditingEntry(null);
      showToast('Rate entry updated successfully!', 'success');
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to update rate entry.', 'error');
    }
  };

  const handleDeleteRateEntry = async (entryId) => {
    if (window.confirm('Are you sure you want to delete this rate entry?')) {
      try {
        await api.delete(`/api/rate-cards/entries/${entryId}`);
        setRateEntries(prev => prev.filter(entry => entry.id !== entryId));
        showToast('Rate entry deleted.', 'success');
      } catch (error) {
        showToast(error.response?.data?.error || 'Failed to delete rate entry.', 'error');
      }
    }
  };

  const handleExport = async () => {
    if (!selectedRateCardId) return;
    try {
      const response = await api.get(`/api/rate-cards/${selectedRateCardId}/export`, {
        responseType: 'blob', // Ważne, aby otrzymać plik
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const rateCardName = rateCards.find(rc => rc.id === selectedRateCardId)?.name || 'rate-card';
      link.setAttribute('download', `${rateCardName.replace(/\s+/g, '_')}_export.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('Export started successfully!', 'success');
    } catch (error) {
      showToast('Failed to export rate card.', 'error');
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditingEntry(prev => ({
      ...prev,
      [name]: value === '' ? null : parseFloat(value)
    }));
  };

  const priceColumns = [
    'price_micro', 'price_quarter', 'price_half', 'price_half_plus',
    'price_full_1', 'price_full_2', 'price_full_3', 'price_full_4', 'price_full_5', 
    'price_full_6', 'price_full_7', 'price_full_8', 'price_full_9', 'price_full_10'
  ];

  const unassignedCustomers = useMemo(() => {
    const assignedIds = new Set(assignedCustomers.map(c => c.id));
    return customers.filter(c => !assignedIds.has(c.id));
  }, [customers, assignedCustomers]);

  // Konfiguracja dla generycznego importera
  const rateCardImporterConfig = {
    title: 'Import Rate Entries',
    apiEndpoint: `/api/rate-cards/${selectedRateCardId}/import`,
    postDataKey: 'entries', // API oczekuje { entries: [...] }
    dataMappingFn: (row) => {
      // Proste mapowanie, zakładając, że nagłówki CSV pasują do oczekiwanych kluczy
      // Można tu dodać bardziej złożoną logikę, jeśli nagłówki się różnią
      return {
        'Rate Type': row['Rate Type'],
        'Zone Name': row['Zone Name'],
        'Service Level': row['Service Level'],
        'Price Micro': row['Price Micro'],
        'Price Quarter': row['Price Quarter'],
        'Price Half': row['Price Half'],
        'Price Half Plus': row['Price Half Plus'],
        'Price Full 1': row['Price Full 1'],
        // ... można dodać resztę kolumn cenowych
      };
    },
    previewColumns: [
      { key: 'Rate Type', header: 'Type' },
      { key: 'Zone Name', header: 'Zone' },
      { key: 'Service Level', header: 'Service' },
      { key: 'Price Full 1', header: 'Price (1 Full)' },
    ],
  };

  return (
    <div>
        <div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Select Rate Card</label>
              <select value={selectedRateCardId} onChange={e => setSelectedRateCardId(e.target.value)}>
                <option value="">-- Select Rate Card --</option>
                {rateCards.map(rc => (
                  <option key={rc.id} value={rc.id}>{rc.name}</option>
                ))}
              </select>
            </div>
            <button onClick={handleCreateRateCard} className="btn-secondary" style={{ alignSelf: 'flex-end' }}>
              <Plus size={16} /> New Rate Card
            </button>
          </div>

          {selectedRateCardId && (
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 2fr', alignItems: 'start' }}>
              {/* Customer Assignment Section */}
              <div className="card">
                <h5>Assigned Customers</h5>
                <div className="form-group">
                  <label>Assign a new customer</label>
                  <select onChange={(e) => handleAssignCustomer(e.target.value)} value="">
                    <option value="">-- Select customer to add --</option>
                    {unassignedCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <ul className="list" style={{ maxHeight: '400px', overflowY: 'auto', paddingLeft: '0', listStyle: 'none' }}>
                  {assignedCustomers.map(c => (
                    <li key={c.id} className="list-item">
                      <span>{c.name}</span>
                      <button onClick={() => handleUnassignCustomer(c.id)} className="btn-icon btn-danger" title="Unassign">
                        <XCircle size={16} />
                      </button>
                    </li>
                  ))}
                   {assignedCustomers.length === 0 && <p className="no-results-message">No customers assigned.</p>}
                </ul>
              </div>

              {/* Rate Entries Section */}
              <div className="card">
                {showAddForm && <AddRateEntryForm zones={zones} onSubmit={handleCreateRateEntry} onCancel={() => setShowAddForm(false)} />}
                {showImporter && <DataImporter {...rateCardImporterConfig} onSuccess={handleImportSuccess} onCancel={() => setShowImporter(false)} />}
                
                {!showAddForm && !showImporter && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h5>Rate Entries</h5>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button onClick={handleExport} className="btn-secondary"><Download size={16} /> Export</button>
                      <button onClick={() => setShowImporter(true)} className="btn-secondary"><Upload size={16} /> Import</button>
                      <button onClick={() => setShowAddForm(true)} className="btn-primary"><Plus size={16} /> Add Rate</button>
                    </div>
                  </div>
                )}
                <div className="table-wrapper" style={{ marginTop: '1rem', display: (showAddForm || showImporter) ? 'none' : 'block' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Zone</th>
                        <th>Service</th>
                        {priceColumns.map(col => (
                          <th key={col} style={{ minWidth: '100px', textTransform: 'capitalize' }}>
                            {col.replace('price_', '').replace(/_/g, ' ')}
                          </th>
                        ))}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr><td colSpan={priceColumns.length + 4} style={{ textAlign: 'center' }}>Loading...</td></tr>
                      ) : rateEntries.length > 0 ?
                        rateEntries.map(entry => {
                          const zoneName = zones.find(z => z.id === entry.zone_id)?.zone_name || 'N/A';
                          const isEditing = editingEntry?.id === entry.id;
                          return (
                            <tr key={entry.id}>
                              <td style={{ textTransform: 'capitalize' }}>{entry.rate_type.replace('_', ' ')}</td>
                              <td>{zoneName}</td>
                              <td>{entry.service_level}</td>
                              {priceColumns.map(col => (
                                <td key={col}>
                                  {isEditing ? (
                                    <input type="number" step="0.01" name={col} value={editingEntry[col] ?? ''} onChange={handleEditChange} style={{ width: '80px' }} />
                                  ) : ( entry[col] )}
                                </td>
                              ))}
                              <td className="actions-cell">
                                {isEditing ? (
                                  <>
                                    <button onClick={handleUpdateRateEntry} className="btn-icon" title="Save"><Save size={16} /></button>
                                    <button onClick={() => setEditingEntry(null)} className="btn-icon" title="Cancel"><XCircle size={16} /></button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => setEditingEntry({ ...entry })} className="btn-icon" title="Edit Rate Entry"><Edit size={16} /></button>
                                    <button onClick={() => handleDeleteRateEntry(entry.id)} className="btn-icon btn-danger" title="Delete Rate Entry"><Trash2 size={16} /></button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })
                       : (
                        <tr><td colSpan={priceColumns.length + 4} style={{ textAlign: 'center' }}>No rate entries found for this rate card.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      
    </div>
  );
};

export default RateCardEditor;