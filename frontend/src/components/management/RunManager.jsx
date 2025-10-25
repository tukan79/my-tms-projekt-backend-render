import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import AddRunForm from '../forms/AddRunForm.jsx';
import DataTable from '../shared/DataTable.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';

const RunManager = ({ runs = [], trucks = [], trailers = [], drivers = [], onDataRefresh, runActions }) => {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingRun, setEditingRun] = useState(null);
  const { showToast } = useToast();

  const handleAddNewRun = useCallback(() => {
    setEditingRun(null);
    setIsFormVisible(true);
  }, []);

  const handleEditRun = useCallback((run) => {
    setEditingRun(run);
    setIsFormVisible(true);
  }, []);

  const handleCancelForm = useCallback(() => {
    setIsFormVisible(false);
    setEditingRun(null);
  }, []);

  const handleSaveRun = useCallback(async (runData) => {
    // This component doesn't have direct access to API actions.
    // It should probably call a prop passed down from a higher-level component.
    // For now, we'll assume `onDataRefresh` handles it.
    console.log('Saving run:', runData);
    // In a real scenario, you'd call something like:
    // if (editingRun) {
    //   await api.put(`/api/runs/${editingRun.id}`, runData);
    // } else {
    //   await api.post('/api/runs', runData);
    // }
    onDataRefresh();
    handleCancelForm();
  }, [onDataRefresh, handleCancelForm]);

  const driverMap = useMemo(() => new Map(drivers.map(d => [d.id, `${d.first_name} ${d.last_name}`])), [drivers]);
  const truckMap = useMemo(() => new Map(trucks.map(t => [t.id, t.registration_plate])), [trucks]);
  const trailerMap = useMemo(() => new Map(trailers.map(t => [t.id, t.registration_plate])), [trailers]);

  const enrichedRuns = useMemo(() => runs.map(run => ({
    ...run,
    driverName: driverMap.get(run.driver_id) || 'N/A',
    truckPlate: truckMap.get(run.truck_id) || 'N/A',
    trailerPlate: run.trailer_id ? trailerMap.get(run.trailer_id) : 'N/A',
  })), [runs, driverMap, truckMap, trailerMap]);

  const columns = [
    {
      key: 'run_date',
      header: 'Date',
      sortable: true,
      render: (item) => new Date(item.run_date).toLocaleDateString(),
    },
    {
      key: 'driverName',
      header: 'Driver',
      sortable: true,
    },
    {
      key: 'truckPlate',
      header: 'Truck',
      sortable: true,
    },
    {
      key: 'trailerPlate',
      header: 'Trailer',
      sortable: true,
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (item) => <span style={{textTransform: 'capitalize'}}>{item.type}</span>
    },
  ];

  const handleDeleteRun = useCallback(async (run) => {
    // Znajdź wzbogacone dane, aby wyświetlić czytelną nazwę w potwierdzeniu
    const enrichedRun = enrichedRuns.find(r => r.id === run.id);
    const driverName = enrichedRun?.driverName || 'N/A';
    const runDate = new Date(run.run_date).toLocaleDateString();

    if (window.confirm(`Are you sure you want to delete run for ${driverName} on ${runDate}?`)) {
      try {
        await runActions.delete(run.id);
        showToast('Run deleted successfully.', 'success');
      } catch (error) {
        showToast(error.response?.data?.error || 'Failed to delete run.', 'error');
      }
    }
  }, [runActions, showToast, enrichedRuns]);

  return (
    <div className="card">
      {isFormVisible && (
        <div className="modal-overlay">
          <AddRunForm
            onSuccess={handleSaveRun}
            onCancel={handleCancelForm}
            itemToEdit={editingRun}
            drivers={drivers}
            trucks={trucks}
            trailers={trailers}
          />
        </div>
      )}

      <div className="card-header">
        <h3>Run Management</h3>
        <button onClick={handleAddNewRun} className="btn-primary">
          <Plus size={16} /> Add New Run
        </button>
      </div>

      <DataTable
        items={enrichedRuns}
        columns={columns}
        onEdit={handleEditRun}
        onDelete={handleDeleteRun}
        filterPlaceholder="Filter runs..."
        filterKeys={['run_date', 'driverName', 'truckPlate', 'trailerPlate', 'type']}
        initialSortKey="run_date"
        initialSortOrder="desc"
        // Usunięto prop `actions`, ponieważ DataTable używa `onEdit` i `onDelete`
      />
    </div>
  );
};

export default RunManager;