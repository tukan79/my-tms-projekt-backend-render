// plik AddTruckForm.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';

const AddTruckForm = ({ onSuccess, onCancel, itemToEdit }) => {
  const isEditMode = Boolean(itemToEdit); // Use the renamed prop
  const initialFormData = {
    registration_plate: '',
    brand: '',
    model: '',
    vin: '',
    production_year: '',
    type_of_truck: 'tractor',
    total_weight: '',
    pallet_capacity: '',
    max_payload_kg: '',
    is_active: true
  };

  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

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
    if (!data.registration_plate) newErrors.registration_plate = 'Registration plate is required.';
    if (!data.brand) newErrors.brand = 'Brand is required.';
    if (!data.model) newErrors.model = 'Model is required.';
    if (data.type_of_truck === 'rigid') {
      if (!data.total_weight) newErrors.total_weight = 'Total weight is required for rigid trucks.';
      if (!data.pallet_capacity) newErrors.pallet_capacity = 'Pallet capacity is required for rigid trucks.';
      if (!data.max_payload_kg) newErrors.max_payload_kg = 'Max payload is required for rigid trucks.';
    }
    return newErrors;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm(formData);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }
    setLoading(true);

    const dataToSend = {
      ...formData,
      production_year: formData.production_year ? Number(formData.production_year) : null,
      total_weight: formData.type_of_truck === 'rigid' && formData.total_weight ? Number(formData.total_weight) : null,
      pallet_capacity: formData.type_of_truck === 'rigid' && formData.pallet_capacity ? Number(formData.pallet_capacity) : null,
      max_payload_kg: formData.type_of_truck === 'rigid' && formData.max_payload_kg ? Number(formData.max_payload_kg) : null,
    };

    const request = isEditMode
      ? api.put(`/api/trucks/${itemToEdit.id}`, dataToSend)
      : api.post('/api/trucks', dataToSend);

    try {
      await request;
      onSuccess();
      onCancel(); // Close form on success
    } catch (error) {
      const errorMessage = error.response?.data?.error || `An error occurred while ${isEditMode ? 'updating' : 'adding'} the vehicle.`;
      setErrors({ form: errorMessage });
      console.error(`Błąd ${isEditMode ? 'aktualizacji' : 'dodawania'} pojazdu:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newFormData = { ...formData, [name]: type === 'checkbox' ? checked : value };
    setFormData(newFormData);

    if (errors[name] || (formData.type_of_truck === 'rigid' && errors[name])) {
      const validationErrors = validateForm(newFormData);
      setErrors(validationErrors);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>{isEditMode ? 'Edit Vehicle' : 'Add New Vehicle'}</h2>
        <button onClick={onCancel} className="btn-icon">
          <X size={20} />
        </button>
      </div>
      {errors.form && <div className="error-message">{errors.form}</div>}
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>Brand:</label>
          <input 
            type="text"
            name="brand"
            value={formData.brand || ''}
            onChange={handleChange}
            required
            className={errors.brand ? 'input-error' : ''}
          />
          {errors.brand && <span className="error-text">{errors.brand}</span>}
        </div>
        <div className="form-group">
          <label>Model:</label>
          <input 
            type="text"
            name="model"
            value={formData.model || ''}
            onChange={handleChange}
            required
            className={errors.model ? 'input-error' : ''}
          />
          {errors.model && <span className="error-text">{errors.model}</span>}
        </div>
        <div className="form-group">
          <label>Registration Plate:</label>
          <input 
            type="text"
            name="registration_plate"
            value={formData.registration_plate || ''}
            onChange={handleChange}
            required
            className={errors.registration_plate ? 'input-error' : ''}
          />
          {errors.registration_plate && <span className="error-text">{errors.registration_plate}</span>}
        </div>
        <div className="form-group">
          <label>VIN:</label>
          <input 
            type="text"
            name="vin"
            value={formData.vin || ''}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label>Production Year:</label>
          <input 
            type="number"
            name="production_year"
            value={formData.production_year || ''}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Vehicle Type:</label>
          <select
            name="type_of_truck"
            value={formData.type_of_truck}
            onChange={handleChange}
            required
          >
            <option value="tractor">Tractor Unit</option>
            <option value="rigid">Rigid Truck</option>
          </select>
        </div>

        {/* ✅ Warunkowe renderowanie nowych pól */}
        {formData.type_of_truck === 'rigid' && (
          <>
            <div className="form-group">
              <label>Total Weight (kg) *</label>
              <input 
                type="number"
                name="total_weight"
                value={formData.total_weight || ''}
                onChange={handleChange}
                required
                className={errors.total_weight ? 'input-error' : ''}
              />
              {errors.total_weight && <span className="error-text">{errors.total_weight}</span>}
            </div>
            <div className="form-group">
              <label>Pallet Capacity *</label>
              <input 
                type="number"
                name="pallet_capacity"
                value={formData.pallet_capacity || ''}
                onChange={handleChange}
                required
                className={errors.pallet_capacity ? 'input-error' : ''}
              />
              {errors.pallet_capacity && <span className="error-text">{errors.pallet_capacity}</span>}
            </div>
            <div className="form-group">
              <label>Max Payload (kg) *</label>
              <input
                type="number"
                name="max_payload_kg"
                value={formData.max_payload_kg || ''}
                onChange={handleChange}
                required
                className={errors.max_payload_kg ? 'input-error' : ''}
              />
              {errors.max_payload_kg && <span className="error-text">{errors.max_payload_kg}</span>}
            </div>
          </>
        )}
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
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (isEditMode ? 'Saving...' : 'Adding...') : (isEditMode ? 'Save Changes' : 'Add Vehicle')}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddTruckForm;