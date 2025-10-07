import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../services/api';

const AddTrailerForm = ({ onSuccess, onCancel, itemToEdit }) => {
  const isEditMode = Boolean(itemToEdit); // Używamy spójnej nazwy propsa
  const initialFormData = {
    registration_plate: '',
    brand: '',
    model: '',
    vin: '',
    production_year: '', // This might be deprecated by your new CSV
    trailer_type: 'curtain', // Default value
    // New fields based on CSV
    description: '',
    category: 'Own',
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
  const [error, setError] = useState(null);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Basic client-side validation
    const requiredFields = ['registration_plate', 'brand', 'description', 'max_payload_kg', 'max_spaces'];
    const isInvalid = requiredFields.some(field => !formData[field]);
    if (isInvalid) {
      setError('All fields marked with an asterisk (*) are required.');
      setLoading(false);
      return;
    }
    
    const dataToSend = {
      ...formData,
      // Ensure numeric fields are sent as numbers
      max_payload_kg: formData.max_payload_kg ? Number(formData.max_payload_kg) : null,
      max_spaces: formData.max_spaces ? Number(formData.max_spaces) : null,
      length_m: formData.length_m ? Number(formData.length_m) : null,
      width_m: formData.width_m ? Number(formData.width_m) : null,
      height_m: formData.height_m ? Number(formData.height_m) : null,
      weight_kg: formData.weight_kg ? Number(formData.weight_kg) : null,
      // Deprecated fields
      production_year: null,
      capacity: null,
    };

    const endpoint = isEditMode ? `/api/trailers/${itemToEdit.id}` : '/api/trailers';
    const method = isEditMode ? 'put' : 'post';

    try {
      await api[method](endpoint, dataToSend);
      onSuccess(); // Używamy spójnej nazwy funkcji zwrotnej
    } catch (err) {
      const errorMessage = err.response?.data?.error || `An error occurred while ${isEditMode ? 'updating' : 'adding'} the trailer.`;
      setError(errorMessage);
      console.error(`Błąd ${isEditMode ? 'aktualizacji' : 'dodawania'} naczepy:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>{isEditMode ? 'Edit Trailer' : 'Add New Trailer'}</h2>
        <button onClick={onCancel} className="btn-icon">
          <X size={20} />
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="form">
        <div className="form-grid">
          <div className="form-column">
            <div className="form-group">
              <label>Trailer Code (Reg. Plate) *</label>
              <input type="text" name="registration_plate" value={formData.registration_plate} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Description *</label>
              <input type="text" name="description" value={formData.description} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Brand *</label>
              <input type="text" name="brand" value={formData.brand} onChange={handleChange} required />
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
              <input type="number" name="max_payload_kg" value={formData.max_payload_kg} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Max Pallet Spaces *</label>
              <input type="number" name="max_spaces" value={formData.max_spaces} onChange={handleChange} required />
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