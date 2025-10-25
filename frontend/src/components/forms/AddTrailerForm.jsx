import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api.js';
import { useToast } from '../../contexts/ToastContext.jsx';

const AddTrailerForm = ({ onSuccess, onCancel, itemToEdit }) => {
  const isEditMode = Boolean(itemToEdit); // Używamy spójnej nazwy propsa
  const initialFormData = {
    registration_plate: '',
    description: '',
    category: 'Own',
    brand: '',
    max_payload_kg: '',
    max_spaces: '',
    length_m: '',
    width_m: '',
    height_m: '',
    weight_kg: '',
    status: 'active',
  };

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { showToast } = useToast();

  useEffect(() => {
    if (isEditMode && itemToEdit) {
      // Mapujemy dane do edycji, zamieniając `null` na `''`, aby uniknąć ostrzeżeń Reacta.
      const sanitizedData = Object.keys(initialFormData).reduce((acc, key) => {
        // Używamy ??, aby obsłużyć zarówno null, jak i undefined.
        acc[key] = itemToEdit[key] ?? initialFormData[key];
        return acc;
      }, {});
      setFormData(sanitizedData);
    } else {
      setFormData(initialFormData);
    }
  }, [itemToEdit, isEditMode]);

  const validateForm = useCallback((data) => {
    const newErrors = {};
    if (!data.registration_plate) newErrors.registration_plate = 'Trailer Code is required.';
    if (!data.description) newErrors.description = 'Description is required.';
    if (!data.brand) newErrors.brand = 'Brand is required.';
    if (!data.max_payload_kg) newErrors.max_payload_kg = 'Max Payload is required.';
    if (!data.max_spaces) newErrors.max_spaces = 'Max Pallet Spaces is required.';
    return newErrors;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm(formData);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setLoading(true);
    
    const dataToSend = {
      ...formData,
      // Ensure numeric fields are sent as numbers
      max_payload_kg: formData.max_payload_kg ? Number(formData.max_payload_kg) : null,
      max_spaces: formData.max_spaces ? Number(formData.max_spaces) : null,
      length_m: formData.length_m ? Number(formData.length_m) : null,
      width_m: formData.width_m ? Number(formData.width_m) : null,
      height_m: formData.height_m ? Number(formData.height_m) : null,
      weight_kg: formData.weight_kg ? Number(formData.weight_kg) : null,
    };

    const endpoint = isEditMode ? `/api/trailers/${itemToEdit.id}` : '/api/trailers';
    const method = isEditMode ? 'put' : 'post';

    try {
      await api[method](endpoint, dataToSend);
      showToast(`Trailer ${isEditMode ? 'updated' : 'added'} successfully!`, 'success');
      onSuccess(); // Używamy spójnej nazwy funkcji zwrotnej
    } catch (err) {
      const errorMessage = err.response?.data?.error || `An error occurred while ${isEditMode ? 'updating' : 'adding'} the trailer.`;
      setErrors({ form: errorMessage });
      showToast(errorMessage, 'error');
      console.error(`Błąd ${isEditMode ? 'aktualizacji' : 'dodawania'} naczepy:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);
    if (errors[name]) {
      const validationErrors = validateForm(newFormData);
      setErrors(validationErrors);
    }
  }, [formData, errors, validateForm]);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>{isEditMode ? 'Edit Trailer' : 'Add New Trailer'}</h2>
        <button onClick={onCancel} className="btn-icon">
          <X size={20} />
        </button>
      </div>

      {errors.form && <div className="error-message">{errors.form}</div>}

      <form onSubmit={handleSubmit} className="form">
        <div className="form-grid">
          <div className="form-column">
            <div className="form-group">
              <label>Trailer Code (Reg. Plate) *</label>
              <input type="text" name="registration_plate" value={formData.registration_plate} onChange={handleChange} required className={errors.registration_plate ? 'input-error' : ''} />
              {errors.registration_plate && <span className="error-text">{errors.registration_plate}</span>}
            </div>
            <div className="form-group">
              <label>Description *</label>
              <input type="text" name="description" value={formData.description} onChange={handleChange} required className={errors.description ? 'input-error' : ''} />
              {errors.description && <span className="error-text">{errors.description}</span>}
            </div>
            <div className="form-group">
              <label>Brand *</label>
              <input type="text" name="brand" value={formData.brand} onChange={handleChange} required className={errors.brand ? 'input-error' : ''} />
              {errors.brand && <span className="error-text">{errors.brand}</span>}
            </div>
            <div className="form-group">
              <label>Category</label>
              <select name="category" value={formData.category} onChange={handleChange}>
                <option value="Own">Own</option>
                <option value="Subcontractor">Subcontractor</option>
              </select>
            </div>
             <div className="form-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="form-column">
            <div className="form-group">
              <label>Max Payload (kg) *</label>
              <input type="number" name="max_payload_kg" value={formData.max_payload_kg} onChange={handleChange} required className={errors.max_payload_kg ? 'input-error' : ''} />
              {errors.max_payload_kg && <span className="error-text">{errors.max_payload_kg}</span>}
            </div>
            <div className="form-group">
              <label>Max Pallet Spaces *</label>
              <input type="number" name="max_spaces" value={formData.max_spaces} onChange={handleChange} required className={errors.max_spaces ? 'input-error' : ''} />
              {errors.max_spaces && <span className="error-text">{errors.max_spaces}</span>}
            </div>
            <div className="form-group">
              <label>Length (m)</label>
              <input type="number" step="0.01" name="length_m" value={formData.length_m} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Width (m)</label>
              <input type="number" step="0.01" name="width_m" value={formData.width_m} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Height (m)</label>
              <input type="number" step="0.01" name="height_m" value={formData.height_m} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Weight (kg)</label>
              <input type="number" name="weight_kg" value={formData.weight_kg} onChange={handleChange} />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (isEditMode ? 'Saving...' : 'Adding...') : (isEditMode ? 'Save Changes' : 'Add Trailer')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddTrailerForm;