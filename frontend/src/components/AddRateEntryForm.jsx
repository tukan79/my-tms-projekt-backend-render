import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { useForm } from '@/hooks/useForm.js';

// Przeniesiono poza komponent, aby uniknąć ponownego tworzenia przy każdym renderowaniu
const initialFormData = {
  rate_type: 'standard',
  zone_id: '',
  service_level: 'A',
  price_micro: '',
  price_quarter: '',
  price_half: '',
  price_half_plus: '',
  price_full_1: '',
  price_full_2: '',
  price_full_3: '',
  price_full_4: '',
  price_full_5: '',
  price_full_6: '',
  price_full_7: '',
  price_full_8: '',
  price_full_9: '',
  price_full_10: '',
};

const priceColumns = [
  'price_micro', 'price_quarter', 'price_half', 'price_half_plus',
  'price_full_1', 'price_full_2', 'price_full_3', 'price_full_4', 'price_full_5',
  'price_full_6', 'price_full_7', 'price_full_8', 'price_full_9', 'price_full_10'
];

const AddRateEntryForm = ({ zones = [], onSubmit, onCancel, itemToEdit }) => {
  const validate = (data) => {
    const newErrors = {};
    if (!data.zone_id) newErrors.zone_id = 'Zone is required.';
    if (!data.service_level) newErrors.service_level = 'Service level is required.';
    return newErrors;
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
    onSubmit, // Zakładamy, że onSubmit jest stabilną funkcją (np. z useCallback)
    itemToEdit: useMemo(() => itemToEdit, [itemToEdit]), // Stabilizujemy itemToEdit
  });

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Add New Rate Entry</h2>
        <button onClick={onCancel} className="btn-icon"><X size={20} /></button>
      </div>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div className="form-group">
            <label>Rate Type</label>
            <select name="rate_type" value={formData.rate_type} onChange={handleChange}>
              <option value="standard">Standard</option>
              <option value="surcharge">Surcharge</option>
            </select>
          </div>
          <div className="form-group">
            <label>Zone *</label>
            <select name="zone_id" value={formData.zone_id} onChange={handleChange} required className={errors.zone_id ? 'input-error' : ''}>
              <option value="">Select a zone...</option>
              {zones.map(zone => <option key={zone.id} value={zone.id}>{zone.zone_name}</option>)}
            </select>
            {errors.zone_id && <span className="error-text">{errors.zone_id}</span>}
          </div>
          <div className="form-group">
            <label>Service Level *</label>
            <select name="service_level" value={formData.service_level} onChange={handleChange} required className={errors.service_level ? 'input-error' : ''}>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
            {errors.service_level && <span className="error-text">{errors.service_level}</span>}
          </div>
        </div>
        <h4>Prices</h4>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
          {priceColumns.map(col => (
            <div className="form-group" key={col}>
              <label style={{ textTransform: 'capitalize' }}>{col.replace('price_', '').replace(/_/g, ' ')}</label>
              <input type="number" step="0.01" name={col} value={formData[col] ?? ''} onChange={handleChange} />
            </div>
          ))}
        </div>
        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Add Entry'}</button>
        </div>
      </form>
    </div>
  );
};

export default AddRateEntryForm;