import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';

const initialFormState = {
  first_name: '',
  last_name: '',
  phone_number: '',
  license_number: '',
  cpc_number: '',
  login_code: '',
  is_active: true,
};

const AddDriverForm = ({ onSuccess, onCancel, itemToEdit }) => {
  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { showToast } = useToast();

  const isEditMode = Boolean(itemToEdit);

  useEffect(() => {
    if (isEditMode && itemToEdit) {
      // Mapujemy dane do edycji, zamieniając `null` na `''`, aby uniknąć ostrzeżeń Reacta.
      const sanitizedData = Object.keys(initialFormState).reduce((acc, key) => {
        // Używamy ??, aby obsłużyć zarówno null, jak i undefined.
        acc[key] = itemToEdit[key] ?? initialFormState[key];
        return acc;
      }, {});

      setFormData(sanitizedData);
    } else {
      setFormData(initialFormState);
    }
  }, [itemToEdit, isEditMode]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError(null);

    // Walidacja po stronie klienta
    const requiredFields = ['first_name', 'last_name', 'license_number'];
    const missingField = requiredFields.find(field => !formData[field]);
    if (missingField) {
      setError(`Field '${missingField.replace('_', ' ')}' is required.`);
      return;
    }

    setLoading(true);

    const endpoint = isEditMode ? `/api/drivers/${itemToEdit.id}` : '/api/drivers';
    const method = isEditMode ? 'put' : 'post';

    try {
      await api[method](endpoint, formData);
      showToast(`Driver ${isEditMode ? 'updated' : 'added'} successfully!`, 'success');
      onSuccess();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'A server error occurred.';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [isEditMode, itemToEdit, formData, onSuccess, showToast]);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prevFormData => ({
      ...prevFormData,
      [name]: type === 'checkbox' ? checked : value
    }));
  }, []);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>{isEditMode ? 'Edit Driver' : 'Add New Driver'}</h2>
        <button onClick={onCancel} className="btn-icon">
          <X size={20} />
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>First Name *</label>
          <input
            type="text"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Last Name *</label>
          <input
            type="text"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Phone Number</label>
          <input
            type="tel"
            name="phone_number"
            value={formData.phone_number}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label>Driver's License Number *</label>
          <input
            type="text"
            name="license_number"
            value={formData.license_number}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Certificate of Professional Competency (CPC)</label>
          <input
            type="text"
            name="cpc_number"
            value={formData.cpc_number}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label>Login Code (for mobile app)</label>
          <input
            type="text"
            name="login_code"
            value={formData.login_code}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
            />
            Active
          </label>
        </div>
        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (isEditMode ? 'Saving...' : 'Adding...') : (isEditMode ? 'Save Changes' : 'Add Driver')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddDriverForm;