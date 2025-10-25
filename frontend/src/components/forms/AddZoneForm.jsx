import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api.js';
import { useToast } from '../../contexts/ToastContext.jsx';

const initialFormData = {
  zone_name: '',
  postcode_patterns: '',
  is_home_zone: false,
};

const AddZoneForm = ({ onSuccess, onCancel, itemToEdit }) => {
  const isEditMode = Boolean(itemToEdit);
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (isEditMode && itemToEdit) {
      setFormData({
        zone_name: itemToEdit.zone_name || '',
        postcode_patterns: (itemToEdit.postcode_patterns || []).join('; '),
        is_home_zone: itemToEdit.is_home_zone || false,
      });
    } else {
      setFormData(initialFormData);
    }
  }, [itemToEdit, isEditMode]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.zone_name || !formData.postcode_patterns) {
      setError('Zone name and postcode patterns are required.');
      return;
    }
    setLoading(true);
    setError(null);

    const payload = {
      ...formData,
      postcode_patterns: formData.postcode_patterns.split(';').map(p => p.trim()).filter(Boolean),
    };

    const request = isEditMode
      ? api.put(`/api/zones/${itemToEdit.id}`, payload)
      : api.post('/api/zones', payload);

    try {
      await request;
      showToast(`Zone ${isEditMode ? 'updated' : 'created'} successfully!`, 'success');
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{isEditMode ? 'Edit Zone' : 'Add New Zone'}</h2>
        <button onClick={onCancel} className="btn-icon"><X size={20} /></button>
      </div>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>Zone Name *</label>
          <input type="text" name="zone_name" value={formData.zone_name} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Postcode Patterns (semicolon-separated, e.g., SW1%; W1A; EC%) *</label>
          <textarea name="postcode_patterns" value={formData.postcode_patterns} onChange={handleChange} required rows="3" />
        </div>
        <div className="form-group"><label><input type="checkbox" name="is_home_zone" checked={formData.is_home_zone} onChange={handleChange} /> Is Home Zone?</label></div>
        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Zone'}</button>
        </div>
      </form>
    </div>
  );
};

export default AddZoneForm;