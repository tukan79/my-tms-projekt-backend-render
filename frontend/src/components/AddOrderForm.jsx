import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../services/api';

// Zdefiniowanie stanu początkowego poza komponentem, aby uniknąć jego ponownego tworzenia przy każdym renderowaniu.
const initialFormData = { 
  order_number: '',
  customer_id: '',
  service_level: 'A', // Domyślnie 'Next Day'
  customer_reference: '',
  status: 'nowe',
  sender_details: { name: '', address1: '', address2: '', townCity: '', postCode: '', contact_person: '', phone_number: '' },
  loading_date_time: '',
  recipient_details: { name: '', address1: '', address2: '', townCity: '', postCode: '', contact_person: '', phone_number: '' },
  unloading_date_time: '',
  cargo_details: {
    description: '',
    pallets: {
      full: { count: '', kilos: '', spaces: '' },
      half: { count: '', kilos: '', spaces: '' },
      plus_half: { count: '', kilos: '', spaces: '' },
      quarter: { count: '', kilos: '', spaces: '' },
      micro: { count: '', kilos: '', spaces: '' },
    },
    final_price: '',
  },
};
const AddOrderForm = ({ onSuccess, onCancel, itemToEdit, clients = [] }) => {
  const isEditMode = Boolean(itemToEdit);

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isEditMode && itemToEdit) {
      // Głębokie scalenie, aby uniknąć błędów, jeśli brakuje zagnieżdżonych obiektów.
      // Deep merge to avoid errors if nested objects are missing.
      setFormData({
        ...initialFormData, // Zapewnia, że wszystkie klucze istnieją
        ...itemToEdit,
        sender_details: { ...initialFormData.sender_details, ...itemToEdit.sender_details },
        recipient_details: { ...initialFormData.recipient_details, ...itemToEdit.recipient_details },
        cargo_details: {
          ...initialFormData.cargo_details, ...itemToEdit.cargo_details,
          pallets: { ...initialFormData.cargo_details.pallets, ...itemToEdit.cargo_details?.pallets }
        },
        status: itemToEdit.status || 'nowe',
        loading_date_time: itemToEdit.loading_date_time ? new Date(itemToEdit.loading_date_time).toISOString().slice(0, 16) : '',
        unloading_date_time: itemToEdit.unloading_date_time ? new Date(itemToEdit.unloading_date_time).toISOString().slice(0, 16) : '',
      });
    } else {
      setFormData(initialFormData);
    }
  }, [itemToEdit, isEditMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNestedChange = (group, e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [group]: {
        ...prev[group],
        [name]: value,
      },
    }));
  };

  const handlePalletChange = (e) => {
    const { name, value, dataset } = e.target;
    const { palletType, field } = dataset;

    setFormData(prev => ({
      ...prev,
      cargo_details: {
        ...prev.cargo_details,
        pallets: {
          ...prev.cargo_details.pallets,
          [palletType]: {
            ...prev.cargo_details.pallets[palletType],
            [field]: value ? parseInt(value, 10) : ''
          }
        },
      }
    }));
  };

  const handleClientSelect = (e) => {
    const selectedClientId = e.target.value;
    const selectedClient = clients.find(c => c.id === parseInt(selectedClientId, 10));

    setFormData(prev => ({
      ...prev,
      customer_id: selectedClientId,
      sender_details: selectedClient ? {
        ...prev.sender_details,
        name: selectedClient.name,
        address1: selectedClient.address || '',
        // Możesz tu dodać więcej pól, jeśli klient ma je zdefiniowane
      } : prev.sender_details,
    }));
  };

  const validateForm = () => {
    const newErrors = { sender_details: {}, recipient_details: {}, cargo_details: {} };

    // Walidacja pól wymaganych
    if (!formData.customer_reference) newErrors.customer_reference = 'Customer reference is required.';
    if (!formData.sender_details.name) newErrors.sender_details.name = 'Name is required.';
    if (!formData.sender_details.townCity) newErrors.sender_details.townCity = 'City is required.';
    if (!formData.loading_date_time) newErrors.loading_date_time = 'Loading date and time are required.';

    if (!formData.recipient_details.name) newErrors.recipient_details.name = 'Name is required.';
    if (!formData.recipient_details.townCity) newErrors.recipient_details.townCity = 'City is required.';
    if (!formData.unloading_date_time) newErrors.unloading_date_time = 'Unloading date and time are required.';

    // Walidacja logiczna dat
    if (formData.loading_date_time && formData.unloading_date_time) {
      const loadingDate = new Date(formData.loading_date_time);
      const unloadingDate = new Date(formData.unloading_date_time);
      if (unloadingDate <= loadingDate) {
        newErrors.unloading_date_time = 'Unloading date must be later than loading date.';
      }
    }

    setErrors(newErrors);
    // Zwraca true, jeśli obiekt błędów jest pusty (poza zagnieżdżonymi pustymi obiektami)
    return Object.values(newErrors).every(val => typeof val !== 'string' && Object.keys(val).length === 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      return; // Zatrzymaj, jeśli walidacja nie przeszła
    }

    setLoading(true);
    setErrors({});

    // Obliczanie sumy wagi ze wszystkich typów palet
    const totalKilos = Object.values(formData.cargo_details.pallets).reduce((sum, pallet) => {
      return sum + (Number(pallet.kilos) || 0);
    }, 0);

    const dataToSend = {
      ...formData,
      loading_date_time: new Date(formData.loading_date_time).toISOString(),
      unloading_date_time: new Date(formData.unloading_date_time).toISOString(),
      cargo_details: {
        ...formData.cargo_details,
        total_kilos: totalKilos,
      },
    };

    const request = isEditMode
      ? api.put(`/api/orders/${itemToEdit.id}`, dataToSend)
      : api.post('/api/orders', dataToSend);

    try {
      await request;
      onSuccess();
      onCancel(); // Close form on success
    } catch (err) {
      const errorMessage = err.response?.data?.error || `An error occurred while ${isEditMode ? 'updating' : 'adding'} the order.`;
      setErrors({ form: errorMessage }); // Set a general form error
      console.error(`Error ${isEditMode ? 'updating' : 'adding'} order:`, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>{isEditMode ? 'Edit Order' : 'Add New Order'}</h2>
        <button onClick={onCancel} className="btn-icon">
          <X size={20} />
        </button>
      </div>

      {errors.form && <div className="error-message">{errors.form}</div>}

      <form onSubmit={handleSubmit} className="form form-grid">
        {/* Left Column */}
        <div className="form-column">
          <div className="form-group">
            <label>Consignment Number</label>
            <input type="text" name="order_number" value={formData.order_number ?? ''} onChange={handleChange} />
            {errors.order_number && <span className="error-text">{errors.order_number}</span>}
          </div>
          <div className="form-group">
            <label>Customer Reference *</label>
            <input type="text" name="customer_reference" value={formData.customer_reference ?? ''} onChange={handleChange} required />
            {errors.customer_reference && <span className="error-text">{errors.customer_reference}</span>}
          </div>
          <div className="form-group">
            <label>Status</label>
            <select name="status" value={formData.status ?? 'nowe'} onChange={handleChange} required>
              <option value="nowe">New</option>
              <option value="zaplanowane">Planned</option>
              <option value="w trakcie">In Progress</option>
              <option value="zakończone">Completed</option>
              <option value="anulowane">Cancelled</option>
            </select>
          </div>
          <div className="form-group">
            <label>Service Level *</label>
            <select name="service_level" value={formData.service_level ?? 'A'} onChange={handleChange} required>
              <option value="A">A (Next Day)</option>
              <option value="B">B (Economy)</option>
              <option value="C">C (Economy 3-day)</option>
              <option value="D">D (Saturday)</option>
            </select>
          </div>

          <h4>Loading / Sender</h4>
          <div className="form-group">
            <label>Client *</label>
            <select name="customer_id" value={formData.customer_id} onChange={handleClientSelect} required>
              <option value="">-- Select a client --</option>
              {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Sender Name (if different from client)</label>
            <input type="text" name="name" value={formData.sender_details.name ?? ''} onChange={(e) => handleNestedChange('sender_details', e)} />
            {errors.sender_details?.name && <span className="error-text">{errors.sender_details.name}</span>}
          </div>
          <div className="form-group">
            <label>Street Address 1</label>
            <input type="text" name="address1" value={formData.sender_details.address1 ?? ''} onChange={(e) => handleNestedChange('sender_details', e)} />
          </div>
          <div className="form-group">
            <label>Street Address 2</label>
            <input type="text" name="address2" value={formData.sender_details.address2 ?? ''} onChange={(e) => handleNestedChange('sender_details', e)} />
          </div>
          <div className="form-group">
            <label>City *</label>
            <input type="text" name="townCity" value={formData.sender_details.townCity ?? ''} onChange={(e) => handleNestedChange('sender_details', e)} required />
            {errors.sender_details?.townCity && <span className="error-text">{errors.sender_details.townCity}</span>}
          </div>
          <div className="form-group">
            <label>Postcode</label>
            <input type="text" name="postCode" value={formData.sender_details.postCode ?? ''} onChange={(e) => handleNestedChange('sender_details', e)} />
          </div>
          <div className="form-group">
            <label>Contact Person</label>
            <input type="text" name="contact_person" value={formData.sender_details.contact_person ?? ''} onChange={(e) => handleNestedChange('sender_details', e)} />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input type="tel" name="phone_number" value={formData.sender_details.phone_number ?? ''} onChange={(e) => handleNestedChange('sender_details', e)} />
          </div>
          <div className="form-group">
            <label>Loading Date & Time *</label>
            <input type="datetime-local" name="loading_date_time" value={formData.loading_date_time ?? ''} onChange={handleChange} required />
            {errors.loading_date_time && <span className="error-text">{errors.loading_date_time}</span>}
          </div>
        </div>

        {/* Right Column */}
        <div className="form-column">
          <h4>Unloading</h4>
          <div className="form-group">
            <label>Recipient Name *</label>
            <input type="text" name="name" value={formData.recipient_details.name ?? ''} onChange={(e) => handleNestedChange('recipient_details', e)} required />
            {errors.recipient_details?.name && <span className="error-text">{errors.recipient_details.name}</span>}
          </div>
          <div className="form-group">
            <label>Street Address 1</label>
            <input type="text" name="address1" value={formData.recipient_details.address1 ?? ''} onChange={(e) => handleNestedChange('recipient_details', e)} />
          </div>
          <div className="form-group">
            <label>Street Address 2</label>
            <input type="text" name="address2" value={formData.recipient_details.address2 ?? ''} onChange={(e) => handleNestedChange('recipient_details', e)} />
          </div>
          <div className="form-group">
            <label>City *</label>
            <input type="text" name="townCity" value={formData.recipient_details.townCity ?? ''} onChange={(e) => handleNestedChange('recipient_details', e)} required />
            {errors.recipient_details?.townCity && <span className="error-text">{errors.recipient_details.townCity}</span>}
          </div>
          <div className="form-group">
            <label>Postcode</label>
            <input type="text" name="postCode" value={formData.recipient_details.postCode ?? ''} onChange={(e) => handleNestedChange('recipient_details', e)} />
          </div>
          <div className="form-group">
            <label>Contact Person</label>
            <input type="text" name="contact_person" value={formData.recipient_details.contact_person ?? ''} onChange={(e) => handleNestedChange('recipient_details', e)} />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input type="tel" name="phone_number" value={formData.recipient_details.phone_number ?? ''} onChange={(e) => handleNestedChange('recipient_details', e)} />
          </div>
          <div className="form-group">
            <label>Unloading Date & Time *</label>
            <input type="datetime-local" name="unloading_date_time" value={formData.unloading_date_time ?? ''} onChange={handleChange} required />
            {errors.unloading_date_time && <span className="error-text">{errors.unloading_date_time}</span>}
          </div>
        </div>

        {/* Bottom Row - Full Width */}
        <div className="form-span-2">
          <h4>Cargo Details</h4>
          <div className="form-group">
            <label>Cargo Description</label>
            <textarea name="description" value={formData.cargo_details.description ?? ''} onChange={(e) => handleNestedChange('cargo_details', e)} rows="2"></textarea>
          </div>
          
          {/* Nowa sekcja dla palet */}
          <div className="pallet-details-grid">
            <div className="grid-header">Pallet Type</div>
            <div className="grid-header">Count</div>
            <div className="grid-header">Weight (kg)</div>
            <div className="grid-header">Spaces</div>

            {Object.keys(formData.cargo_details.pallets).map(type => (
              <React.Fragment key={type}>
                <div className="pallet-type-label">
                  {type === 'plus_half' 
                    ? '+Half' 
                    : type.charAt(0).toUpperCase() + type.slice(1)}
                </div>
                <div className="form-group">
                  <input type="number" data-pallet-type={type} data-field="count" value={formData.cargo_details.pallets[type]?.count ?? ''} onChange={handlePalletChange} />
                </div>
                <div className="form-group">
                  <input type="number" data-pallet-type={type} data-field="kilos" value={formData.cargo_details.pallets[type]?.kilos ?? ''} onChange={handlePalletChange} />
                </div>
                <div className="form-group">
                  <input type="number" data-pallet-type={type} data-field="spaces" value={formData.cargo_details.pallets[type]?.spaces ?? ''} onChange={handlePalletChange} />
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="form-span-2">
          <div className="form-group">
            <label>Final Price (£)</label>
            <input type="number" step="0.01" name="final_price" value={formData.final_price ?? ''} onChange={handleChange} placeholder="Calculated automatically or enter manually" />
          </div>
        </div>

        <div className="form-actions form-span-2">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (isEditMode ? 'Saving...' : 'Adding...') : (isEditMode ? 'Save Changes' : 'Add Order')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddOrderForm;