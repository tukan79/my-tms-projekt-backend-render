import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const initialFormData = {
  rate_type: 'standard',
  source_zone_id: '',
  destination_zone_id: null,
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

const AddRateEntryForm = ({ zones = [], onSubmit, onCancel }) => {
  const [formData, setFormData] = useState(initialFormData);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Reset destination zone if rate type is not point-to-point
  useEffect(() => {
    if (formData.rate_type !== 'point_to_point') {
      setFormData(prev => ({ ...prev, destination_zone_id: null }));
    }
  }, [formData.rate_type]);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Konwersja pustych stringów na null dla pól numerycznych
    const payload = Object.entries(formData).reduce((acc, [key, value]) => {
      if (key.startsWith('price_') && value === '') {
        acc[key] = null;
      } else {
        acc[key] = value;
      }
      return acc;
    }, {});
    onSubmit(payload);
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Add New Rate Entry</h3>
        <button onClick={onCancel} className="btn-icon"><X size={20} /></button>
      </div>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="form-group">
            <label>Rate Type</label>
            <select name="rate_type" value={formData.rate_type} onChange={handleChange}>
              <option value="standard">Standard</option>
              <option value="point_to_point">Point to Point</option>
            </select>
          </div>
          <div className="form-group">
            <label>Service Level</label>
            <select name="service_level" value={formData.service_level} onChange={handleChange}>
              <option value="A">A (Next Day)</option>
              <option value="B">B (Economy)</option>
              <option value="C">C (Economy 3-day)</option>
              <option value="D">D (Saturday)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Source Zone</label>
            <select name="source_zone_id" value={formData.source_zone_id} onChange={handleChange} required>
              <option value="">-- Select Zone --</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.zone_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Destination Zone</label>
            <select
              name="destination_zone_id"
              value={formData.destination_zone_id || ''}
              onChange={handleChange}
              disabled={formData.rate_type !== 'point_to_point'}
              required={formData.rate_type === 'point_to_point'}
            >
              <option value="">{formData.rate_type !== 'point_to_point' ? 'N/A' : '-- Select Zone --'}</option>
              {/* Dla destination zawsze pokazujemy wszystkie strefy */}
              {zones.map(z => <option key={z.id} value={z.id}>{z.zone_name}</option>)}
            </select>
          </div>
        </div>

        <h4 style={{ marginTop: '2rem' }}>Non-Full Pallet Prices</h4>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <div className="form-group"><label>Micro</label><input type="number" step="0.01" name="price_micro" value={formData.price_micro} onChange={handleChange} /></div>
          <div className="form-group"><label>Quarter</label><input type="number" step="0.01" name="price_quarter" value={formData.price_quarter} onChange={handleChange} /></div>
          <div className="form-group"><label>Half</label><input type="number" step="0.01" name="price_half" value={formData.price_half} onChange={handleChange} /></div>
          <div className="form-group"><label>Half+</label><input type="number" step="0.01" name="price_half_plus" value={formData.price_half_plus} onChange={handleChange} /></div>
        </div>

        <h4 style={{ marginTop: '2rem' }}>Full Pallet Prices</h4>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <div className="form-group"><label>1 Full Pal</label><input type="number" step="0.01" name="price_full_1" value={formData.price_full_1} onChange={handleChange} /></div>
          <div className="form-group"><label>2 Full Pals</label><input type="number" step="0.01" name="price_full_2" value={formData.price_full_2} onChange={handleChange} /></div>
          <div className="form-group"><label>3 Full Pals</label><input type="number" step="0.01" name="price_full_3" value={formData.price_full_3} onChange={handleChange} /></div>
          <div className="form-group"><label>4 Full Pals</label><input type="number" step="0.01" name="price_full_4" value={formData.price_full_4} onChange={handleChange} /></div>
          <div className="form-group"><label>5 Full Pals</label><input type="number" step="0.01" name="price_full_5" value={formData.price_full_5} onChange={handleChange} /></div>
          <div className="form-group"><label>6 Full Pals</label><input type="number" step="0.01" name="price_full_6" value={formData.price_full_6} onChange={handleChange} /></div>
          <div className="form-group"><label>7 Full Pals</label><input type="number" step="0.01" name="price_full_7" value={formData.price_full_7} onChange={handleChange} /></div>
          <div className="form-group"><label>8 Full Pals</label><input type="number" step="0.01" name="price_full_8" value={formData.price_full_8} onChange={handleChange} /></div>
          <div className="form-group"><label>9 Full Pals</label><input type="number" step="0.01" name="price_full_9" value={formData.price_full_9} onChange={handleChange} /></div>
          <div className="form-group"><label>10 Full Pals</label><input type="number" step="0.01" name="price_full_10" value={formData.price_full_10} onChange={handleChange} /></div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">Save Rate</button>
        </div>
      </form>
    </div>
  );
};

export default AddRateEntryForm;