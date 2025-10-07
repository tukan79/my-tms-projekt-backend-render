import React, { useState, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { useApiResource } from '../hooks/useApiResource';
import { useToast } from '../contexts/ToastContext';

const RunManager = ({ trucks = [], trailers = [], drivers = [] }) => {
  const { 
    data: runs, 
    error: apiError, 
    createResource: createRun, 
    deleteResource: deleteRunApi 
  } = useApiResource('/api/runs', 'run');
  
  const [formData, setFormData] = useState({
    run_date: new Date().toISOString().split('T')[0],
    type: 'collection',
    truck_id: '',
    trailer_id: '',
    driver_id: '',
  });
  const { showToast } = useToast();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateRun = async () => {
    if (!formData.run_date || !formData.type || !formData.driver_id || !formData.truck_id) {
      showToast("Run date, type, driver, and truck are required.", 'error');
      return;
    }

    try {
      await createRun({
        ...formData,
        truck_id: parseInt(formData.truck_id, 10),
        trailer_id: formData.trailer_id ? parseInt(formData.trailer_id, 10) : null,
        driver_id: parseInt(formData.driver_id, 10),
      });
      showToast('Run created successfully!', 'success');
      // Reset form partially
      setFormData(prev => ({ ...prev, truck_id: '', trailer_id: '', driver_id: '' }));
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'An error occurred while creating the run.';
      showToast(errorMessage, 'error');
    }
  };

  const handleDeleteRun = async (runId) => {
    if (!window.confirm('Are you sure you want to delete this run? This action cannot be undone.')) return;
    try {
      await deleteRunApi(runId);
      showToast('Run deleted successfully!', 'success');
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'An error occurred while deleting the run.';
      showToast(errorMessage, 'error');
    }
  };

  const enrichedRuns = useMemo(() => 
    (Array.isArray(runs) ? runs : []).map(run => {
      const truck = trucks.find(t => t.id === run.truck_id);
      const trailer = trailers.find(t => t.id === run.trailer_id);
      const driver = drivers.find(d => d.id === run.driver_id);
      return {
        ...run,
        truck_info: truck ? `${truck.brand} (${truck.registration_plate})` : 'N/A',
        trailer_info: trailer ? `${trailer.brand} (${trailer.registration_plate})` : 'N/A',
        driver_name: driver ? `${driver.first_name} ${driver.last_name}` : 'N/A'
      };
    }), [runs, trucks, trailers, drivers]);

  return (
    <div className="card">
      <h2>Manage Runs</h2>
      {apiError && <div className="error-message">{apiError}</div>}
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'end', flexWrap: 'wrap' }}>
        <div className="form-group"><label>Date:</label><input type="date" name="run_date" value={formData.run_date} onChange={handleChange} /></div>
        <div className="form-group"><label>Type:</label><select name="type" value={formData.type} onChange={handleChange}><option value="collection">Collection</option><option value="delivery">Delivery</option><option value="trunking">Trunking</option></select></div>
        <div className="form-group"><label>Vehicle:</label><select name="truck_id" value={formData.truck_id} onChange={handleChange}><option value="">Select vehicle</option>{trucks.map(t => <option key={t.id} value={t.id}>{t.brand} ({t.registration_plate})</option>)}</select></div>
        <div className="form-group"><label>Trailer:</label><select name="trailer_id" value={formData.trailer_id} onChange={handleChange}><option value="">Select trailer</option>{trailers.map(t => <option key={t.id} value={t.id}>{t.brand} ({t.registration_plate})</option>)}</select></div>
        <div className="form-group"><label>Driver:</label><select name="driver_id" value={formData.driver_id} onChange={handleChange}><option value="">Select driver</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}</select></div>
        <button onClick={handleCreateRun} className="btn-primary">Create Run</button>
      </div>

      <h3>Planned Runs</h3>
      <div className="list">
        {enrichedRuns.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Driver</th>
                <th>Vehicle</th>
                <th>Trailer</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrichedRuns.map(run => (
                <tr key={run.id}>
                  <td>{new Date(run.run_date).toLocaleDateString()}</td>
                  <td style={{ textTransform: 'capitalize' }}>{run.type}</td>
                  <td>{run.driver_name}</td>
                  <td>{run.truck_info}</td>
                  <td>{run.trailer_info}</td>
                  <td><span className={`status status-${run.status}`}>{run.status}</span></td>
                  <td className="actions-cell">
                    <button onClick={() => handleDeleteRun(run.id)} className="btn-icon btn-danger" title="Delete Run">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No planned runs.</p>
        )}
      </div>
    </div>
  );
};

export default RunManager;