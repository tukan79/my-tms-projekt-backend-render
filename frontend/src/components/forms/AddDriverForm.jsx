import React from 'react';
import { X } from 'lucide-react';
import api from '@/services/api';
import { useToast } from '@/contexts/ToastContext';
import { useForm } from '@/hooks/useForm.js';

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
  const { showToast } = useToast();
  const isEditMode = Boolean(itemToEdit);

  // Funkcja do walidacji formularza
  const validate = (data) => {
    const newErrors = {};
    if (!data.first_name) newErrors.first_name = 'First name is required.';
    if (!data.last_name) newErrors.last_name = 'Last name is required.';
    if (!data.license_number) newErrors.license_number = 'License number is required.';
    return newErrors;
  };

  const performSubmit = async (formData) => {
    const endpoint = isEditMode ? `/api/drivers/${itemToEdit.id}` : '/api/drivers';
    const method = isEditMode ? 'put' : 'post';

    try {
      await api[method](endpoint, formData);
      showToast(`Driver ${isEditMode ? 'updated' : 'added'} successfully!`, 'success');
      if (onSuccess) onSuccess();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'A server error occurred.';
      showToast(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  const {
    formData,
    errors,
    loading,
    handleChange,
    handleSubmit,
  } = useForm({ initialState: initialFormState, validate, onSubmit: performSubmit, itemToEdit });

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>{isEditMode ? 'Edit Driver' : 'Add New Driver'}</h2>
        <button onClick={onCancel} className="btn-icon">
          <X size={20} />
        </button>
      </div>

      {errors.form && <div className="error-message">{errors.form}</div>}

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>First Name *</label>
          <input
            type="text"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            required
            className={errors.first_name ? 'input-error' : ''}
          />
          {errors.first_name && <span className="error-text">{errors.first_name}</span>}
        </div>

        <div className="form-group">
          <label>Last Name *</label>
          <input
            type="text"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            required
            className={errors.last_name ? 'input-error' : ''}
          />
          {errors.last_name && <span className="error-text">{errors.last_name}</span>}
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
            className={errors.license_number ? 'input-error' : ''}
          />
          {errors.license_number && <span className="error-text">{errors.license_number}</span>}
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
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>
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