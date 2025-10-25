// frontend/src/components/AddCustomerForm.jsx
import React from 'react';
import { X } from 'lucide-react';
import api from '../../services/api.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useForm } from '../../hooks/useForm.js';

const initialFormData = {
  // initialFormData jest teraz tylko wzorem, a nie stanem
  // initialFormData is now just a template, not the state
  customer_code: '',
  name: '',
  address_line1: '',
  address_line2: '',
  address_line3: '',
  address_line4: '',
  postcode: '',
  phone_number: '',
  country_code: 'GB',
  category: '',
  currency: 'GBP',
  vat_number: '',
  payment_terms: '30',
  status: 'active',
  pod_on_portal: false,
  invoice_on_portal: false,
  handheld_status_on_portal: false,
  eta_status_on_portal: false,
  general_status_on_portal: false,
};

const AddCustomerForm = ({ onSuccess, onCancel, itemToEdit }) => {
  const isEditMode = Boolean(itemToEdit);
  const { showToast } = useToast();

  const validate = (data) => {
    const newErrors = {};
    if (!data.name) newErrors.name = 'Customer name is required.';
    if (!data.customer_code) newErrors.customer_code = 'Customer code is required.';
    return newErrors;
  };

  const performSubmit = async (formData) => {
    const request = isEditMode
      ? api.put(`/api/customers/${itemToEdit.id}`, formData)
      : api.post('/api/customers', formData);

    try {
      await request;
      showToast(`Customer ${isEditMode ? 'updated' : 'added'} successfully!`, 'success');
      onSuccess();
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'An unexpected error occurred.';
      showToast(errorMessage, 'error');
      // Rzucamy błąd, aby hook useForm mógł go obsłużyć, jeśli zajdzie taka potrzeba
      throw new Error(errorMessage);
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
    itemToEdit,
  });

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>{isEditMode ? 'Edit Customer' : 'Add New Customer'}</h2>
        <button onClick={onCancel} className="btn-icon"><X size={20} /></button>
      </div>
      {errors.form && <div className="error-message">{errors.form}</div>}
      <form onSubmit={handleSubmit} className="form">
        <div className="form-grid">
          {/* Kolumna lewa */}
          <div className="form-column">
            <h4>Main Details</h4>
            <div className="form-group">
              <label>Customer Code</label>
              <input type="text" name="customer_code" value={formData.customer_code ?? ''} onChange={handleChange} className={errors.customer_code ? 'input-error' : ''} />
              {errors.customer_code && <span className="error-text">{errors.customer_code}</span>}
            </div>
            <div className="form-group">
              <label>Customer Name *</label>
              <input type="text" name="name" value={formData.name ?? ''} onChange={handleChange} required className={errors.name ? 'input-error' : ''} />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>
            <div className="form-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <input type="text" name="category" value={formData.category ?? ''} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>VAT Number</label>
              <input type="text" name="vat_number" value={formData.vat_number ?? ''} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Payment Terms (days)</label>
              <input type="number" name="payment_terms" value={formData.payment_terms ?? ''} onChange={handleChange} />
            </div>
             <div className="form-group">
              <label>Currency</label>
              <input type="text" name="currency" value={formData.currency ?? ''} onChange={handleChange} />
            </div>
          </div>

          {/* Kolumna prawa */}
          <div className="form-column">
            <h4>Address & Contact</h4>
            <div className="form-group">
              <label>Address Line 1</label>
              <input type="text" name="address_line1" value={formData.address_line1 ?? ''} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Address Line 2</label>
              <input type="text" name="address_line2" value={formData.address_line2 ?? ''} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Postcode</label>
              <input type="text" name="postcode" value={formData.postcode ?? ''} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input type="tel" name="phone_number" value={formData.phone_number ?? ''} onChange={handleChange} />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Customer'}</button>
        </div>
      </form>
    </div>
  );
};

export default AddCustomerForm;