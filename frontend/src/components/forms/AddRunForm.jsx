import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useForm } from '../../hooks/useForm.js'; // Poprawiona ścieżka

// Przeniesiono poza komponent, aby uniknąć ponownego tworzenia przy każdym renderowaniu
const initialFormData = {
  run_date: new Date().toISOString().split('T')[0],
  type: 'delivery',
  driver_id: '',
  truck_id: '',
  trailer_id: '',
};

const AddRunForm = ({ onSuccess, onCancel, itemToEdit, drivers = [], trucks = [], trailers = [] }) => {
  const isEditMode = Boolean(itemToEdit);
  const { showToast } = useToast();

  const validate = (data) => {
    const newErrors = {};
    if (!data.run_date) newErrors.run_date = 'Run date is required.';
    if (!data.driver_id) newErrors.driver_id = 'Driver is required.';
    if (!data.truck_id) newErrors.truck_id = 'Truck is required.';
    return newErrors;
  };

  const performSubmit = async (formData) => {
    try {
      await onSuccess(formData);
    } catch (error) {
      showToast(error.message || `Failed to ${isEditMode ? 'update' : 'create'} run.`, 'error');
      throw error; // Rzucamy błąd dalej
    }
  };

  const {
    formData,
    errors,
    loading,
    handleChange,
    handleSubmit,
  } = useForm({
    initialState: initialFormData,
    validate,
    onSubmit: performSubmit,
    // Poprawka: Używamy useMemo, aby ustabilizować obiekt `itemToEdit` i uniknąć pętli renderowania.
    itemToEdit: useMemo(() => (
      itemToEdit ? {
        ...itemToEdit,
        run_date: itemToEdit.run_date ? new Date(itemToEdit.run_date).toISOString().split('T')[0] : initialFormData.run_date,
        driver_id: itemToEdit.driver_id || '',
        truck_id: itemToEdit.truck_id || '',
        trailer_id: itemToEdit.trailer_id || '',
      } : null
    ), [itemToEdit]),
  });

  return (
    <div className="card" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1010, width: '400px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>{isEditMode ? 'Edit Run' : 'Add New Run'}</h2>
        <button type="button" onClick={onCancel} className="btn-icon" aria-label="Close add run form"><X size={20} /></button>
      </div>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>Run Date</label>
          <input type="date" name="run_date" value={formData.run_date} onChange={handleChange} required className={errors.run_date ? 'input-error' : ''} />
          {errors.run_date && <span className="error-text">{errors.run_date}</span>}
        </div>
        <div className="form-group">
          <label>Driver</label>
          <select name="driver_id" value={formData.driver_id} onChange={handleChange} required className={errors.driver_id ? 'input-error' : ''}>
            <option value="">Select a driver...</option>
            {drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.first_name} {driver.last_name}</option>)}
          </select>
          {errors.driver_id && <span className="error-text">{errors.driver_id}</span>}
        </div>
        <div className="form-group">
          <label>Truck</label>
          <select name="truck_id" value={formData.truck_id} onChange={handleChange} required className={errors.truck_id ? 'input-error' : ''}>
            <option value="">Select a truck...</option>
            {trucks.map(truck => <option key={truck.id} value={truck.id}>{truck.registration_plate}</option>)}
          </select>
          {errors.truck_id && <span className="error-text">{errors.truck_id}</span>}
        </div>
        <div className="form-group">
          <label>Trailer (optional)</label>
          <select name="trailer_id" value={formData.trailer_id} onChange={handleChange}>
            <option value="">Select a trailer...</option>
            {trailers.map(trailer => <option key={trailer.id} value={trailer.id}>{trailer.registration_plate}</option>)}
          </select>
        </div>
        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Add Run')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddRunForm;