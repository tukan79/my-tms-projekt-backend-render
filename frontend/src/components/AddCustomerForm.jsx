// frontend/src/components/AddCustomerForm.jsx
import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import api from '../services/api.js';

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
  payment_terms: '14',
  status: 'active',
  pod_on_portal: false,
  invoice_on_portal: false,
  handheld_status_on_portal: false,
  eta_status_on_portal: false,
  general_status_on_portal: false,
};

const AddCustomerForm = ({ onSuccess, onCancel, itemToEdit }) => {
  const isEditMode = Boolean(itemToEdit);
  // Inicjalizacja stanu za pomocą funkcji, aby uniknąć problemów z referencją
  // Initialize state using a function to avoid issues with the reference
  const [formData, setFormData] = useState(() => ({ ...initialFormData }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
   if (isEditMode && itemToEdit) {
      setFormData({ ...initialFormData, ...itemToEdit });
    } else {
      setFormData(() => ({ ...initialFormData }));
    }
  }, [itemToEdit, isEditMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      setError('Customer name is required.');
      return;
    }
    setLoading(true);
    setError(null);

    const request = isEditMode
      ? api.put(`/api/customers/${itemToEdit.id}`, formData)
      : api.post('/api/customers', formData);

    try {
      await request;
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
        <h2>{isEditMode ? 'Edit Customer' : 'Add New Customer'}</h2>
        <button onClick={onCancel} className="btn-icon"><X size={20} /></button>
      </div>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit} className="form">
        <div className="form-grid">
          {/* Kolumna lewa */}
          <div className="form-column">
            <h4>Main Details</h4>
            <div className="form-group">
              <label>Customer Code</label>
              <input type="text" name="customer_code" value={formData.customer_code ?? ''} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Customer Name *</label>
              <input type="text" name="name" value={formData.name ?? ''} onChange={handleChange} required />
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