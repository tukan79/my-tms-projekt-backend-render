import React, { useMemo, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useForm } from '@/hooks/useForm.js';
import api from '@/services/api.js';
import { useToast } from '@/contexts/ToastContext.jsx';

// Przywrócona, pełna struktura danych dla formularza zlecenia
const initialFormData = {
  customer_id: '',
  order_number: '',
  customer_reference: '',
  service_level: 'A',
  status: 'nowe',
  sender_details: {
    name: '',
    address1: '',
    address2: '',
    city: '',
    postCode: '',
    contactName: '',
    contactPhone: '',
  },
  recipient_details: {
    name: '',
    address1: '',
    address2: '',
    city: '',
    postCode: '',
    contactName: '',
    contactPhone: '',
  },
  cargo_details: {
    pallets: [], // Zmienione na tablicę, aby umożliwić dynamiczne dodawanie
    total_kilos: 0,
    total_spaces: 0,
  },
  loading_date_time: new Date().toISOString().split('T')[0],
  unloading_date_time: new Date().toISOString().split('T')[0],
  unloading_start_time: '',
  unloading_end_time: '',
  selected_surcharges: [],
  notes: '',
  final_price: '',
};

const AddOrderForm = ({ onSuccess, onCancel, itemToEdit, clients = [], surcharges = [] }) => {
  const isEditMode = Boolean(itemToEdit);
  const { showToast } = useToast();

  const validate = (data) => {
    const newErrors = {};
    if (!data.customer_id) newErrors.customer_id = 'Customer is required.';
    if (!data.sender_details.name) newErrors.sender_name = 'Sender name is required.';
    if (!data.recipient_details.name) newErrors.recipient_name = 'Recipient name is required.';
    return newErrors;
  };

  const performSubmit = async (formData) => {
    const endpoint = isEditMode ? `/api/orders/${itemToEdit.id}` : '/api/orders';
    const method = isEditMode ? 'put' : 'post';
    try {
      await api[method](endpoint, formData);
      showToast(`Order ${isEditMode ? 'updated' : 'created'} successfully!`, 'success');
      if (onSuccess) onSuccess();
    } catch (error) {
      const errorMessage = error.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} order.`;
      showToast(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };
  
  const {
    formData,
    setFormData,
    errors,
    loading,
    handleChange,
    handleNestedChange,
    handleSubmit,
  } = useForm({
    initialState: initialFormData,
    validate,
    onSubmit: performSubmit,
    itemToEdit: useMemo(() => (itemToEdit ? {
        ...itemToEdit,
        // OSTATECZNA POPRAWKA: Bezpieczne formatowanie daty, które unika konwersji stref czasowych.
        // Po prostu "odcinamy" część z godziną, jeśli istnieje.
        loading_date_time: itemToEdit.loading_date_time
          ? String(itemToEdit.loading_date_time).split('T')[0]
          : initialFormData.loading_date_time,
        unloading_date_time: itemToEdit.unloading_date_time
          ? String(itemToEdit.unloading_date_time).split('T')[0]
          : initialFormData.unloading_date_time,
      } : null
    ), [itemToEdit]),
  });

  // Obliczanie sumy miejsc paletowych i wagi
  useEffect(() => {
    setFormData(prev => {
      const palletsRaw = prev.cargo_details?.pallets;
      const pallets = Array.isArray(palletsRaw)
        ? palletsRaw
        : palletsRaw && typeof palletsRaw === 'object'
          ? Object.entries(palletsRaw).map(([type, d]) => ({
              type,
              quantity: Number(d?.quantity ?? d?.count ?? 0) || 0,
              spaces: Number(d?.spaces ?? 0) || 0,
              weight: Number(d?.weight ?? 0) || 0,
            })).filter(p => p.quantity > 0)
          : [];

      const totalSpaces = pallets.reduce((sum, p) => sum + (Number(p.spaces) * Number(p.quantity)), 0);
      const totalKilos = pallets.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);

      // Zwracamy nowy stan tylko wtedy, gdy coś się zmieniło, aby uniknąć pętli
      if (prev.cargo_details.total_spaces !== totalSpaces || prev.cargo_details.total_kilos !== totalKilos) {
        return {
          ...prev,
          cargo_details: { ...prev.cargo_details, pallets, total_spaces: totalSpaces, total_kilos: totalKilos }
        };
      }
      return prev; // Zwracamy poprzedni stan, jeśli nic się nie zmieniło
    });
  }, [formData?.cargo_details?.pallets]); // Usunięto setFormData z zależności

  const handleSurchargeChange = (e) => {
    const { value, checked } = e.target;
    const selectedSurchargeDef = surcharges.find(s => s.code === value);

    setFormData(prev => {
      let updatedSurcharges = [...(prev.selected_surcharges || [])];

      if (checked) {
        let newStartTime = prev.unloading_start_time;
        let newEndTime = prev.unloading_end_time;

        if (selectedSurchargeDef?.requires_time) {
          // Odznacz inne dopłaty czasowe
          const timeSurchargeCodes = surcharges.filter(s => s.requires_time).map(s => s.code);
          updatedSurcharges = updatedSurcharges.filter(code => !timeSurchargeCodes.includes(code));          
          // Jeśli dopłata to 'BW' (okno czasowe), nie ustawiamy domyślnych czasów od razu,
          // pozwalamy użytkownikowi wybrać z listy.
          if (selectedSurchargeDef.code !== 'BW') {
            newStartTime = selectedSurchargeDef.start_time || prev.unloading_start_time;
            newEndTime = selectedSurchargeDef.end_time || prev.unloading_end_time;
          } else {
            // Dla BW czyścimy czasy, aby użytkownik musiał wybrać z listy
            newStartTime = '';
            newEndTime = '';
          }
        }
        updatedSurcharges.push(value);
        return { ...prev, selected_surcharges: updatedSurcharges, unloading_start_time: newStartTime, unloading_end_time: newEndTime };
      } else {
        updatedSurcharges = updatedSurcharges.filter(code => code !== value);
        // Jeśli odznaczono ostatnią dopłatę czasową, wyczyść czasy
        const remainingTimeSurcharge = updatedSurcharges.some(code => surcharges.find(s => s.code === code)?.requires_time);
        const newStartTime = remainingTimeSurcharge ? prev.unloading_start_time : '';
        const newEndTime = remainingTimeSurcharge ? prev.unloading_end_time : '';
        return { ...prev, selected_surcharges: updatedSurcharges, unloading_start_time: newStartTime, unloading_end_time: newEndTime };
      }
    });
  };

  const timeWindowOptions = useMemo(() => {
    const bwSurcharge = surcharges.find(s => s.code === 'BW');
    if (!formData.selected_surcharges?.includes('BW') || !bwSurcharge?.start_time || !bwSurcharge?.end_time) {
      return [];
    }

    const options = [];
    let start = new Date(`1970-01-01T${bwSurcharge.start_time}`);
    const endLimit = new Date(`1970-01-01T${bwSurcharge.end_time}`);

    while (new Date(start.getTime() + 4 * 60 * 60 * 1000) <= endLimit) {
      const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
      const startTimeStr = start.toTimeString().slice(0, 5);
      const endTimeStr = end.toTimeString().slice(0, 5);
      options.push({ value: `${startTimeStr}-${endTimeStr}`, label: `${startTimeStr} - ${endTimeStr}` });
      start.setHours(start.getHours() + 1);
    }
    return options;
  }, [formData.selected_surcharges, surcharges]);

  const handleTimeWindowChange = (e) => {
    const [start, end] = e.target.value.split('-');
    setFormData(prev => ({
      ...prev,
      unloading_start_time: start,
      unloading_end_time: end,
    }));
  };

  const handlePalletChange = (index, field, value) => {
    setFormData(prev => {
      const currentPallets = Array.isArray(prev?.cargo_details?.pallets) ? prev.cargo_details.pallets : [];
      const newPallets = [...currentPallets];
      newPallets[index] = { ...newPallets[index], [field]: value };
      return {
        ...prev,
        cargo_details: { ...prev.cargo_details, pallets: newPallets },
      };
    });
  };

  const addPalletRow = () => {
    setFormData(prev => ({
      ...prev,
      cargo_details: {
        ...prev.cargo_details,
        pallets: [...(Array.isArray(prev?.cargo_details?.pallets) ? prev.cargo_details.pallets : []), { type: 'full', quantity: 1, weight: 0, spaces: 1 }],
      },
    }));
  };

  const removePalletRow = (index) => {
    setFormData(prev => {
      const currentPallets = Array.isArray(prev?.cargo_details?.pallets) ? prev.cargo_details.pallets : [];
      const newPallets = currentPallets.filter((_, i) => i !== index);
      return { ...prev, cargo_details: { ...prev.cargo_details, pallets: newPallets } };
    });
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>{isEditMode ? 'Edit Order' : 'Add New Order'}</h2>
        <button onClick={onCancel} className="btn-icon"><X size={20} /></button>
      </div>
      <form onSubmit={handleSubmit} className="form" style={{ maxHeight: '80vh', overflowY: 'auto', paddingRight: '1rem' }}>
        <div className="form-grid">
          {/* General Info */}
          <div className="form-group form-span-2"><label>Customer *</label><select name="customer_id" value={formData.customer_id} onChange={handleChange} required><option value="">Select a customer...</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="form-group"><label>Order Number</label><input type="text" name="order_number" value={formData.order_number} onChange={handleChange} /></div>
          <div className="form-group"><label>Customer Reference</label><input type="text" name="customer_reference" value={formData.customer_reference} onChange={handleChange} /></div>
          <div className="form-group"><label>Service Level</label><select name="service_level" value={formData.service_level} onChange={handleChange}><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></div>
          <div className="form-group"><label>Status</label><select name="status" value={formData.status} onChange={handleChange}><option value="nowe">New</option><option value="w trakcie">In Progress</option><option value="zakończone">Completed</option><option value="anulowane">Cancelled</option></select></div>
        </div>

        <div className="form-grid">
          {/* Sender Details */}
          <div className="form-column">
            <h4>Sender Details</h4>
            <div className="form-group"><label>Name *</label><input type="text" name="name" value={formData.sender_details.name} onChange={e => handleNestedChange('sender_details', e)} required /></div>
            <div className="form-group"><label>Address 1</label><input type="text" name="address1" value={formData.sender_details.address1} onChange={e => handleNestedChange('sender_details', e)} /></div>
            <div className="form-group"><label>Postcode</label><input type="text" name="postCode" value={formData.sender_details.postCode} onChange={e => handleNestedChange('sender_details', e)} /></div>
            <div className="form-group"><label>Loading Date</label><input type="date" name="loading_date_time" value={formData.loading_date_time} onChange={handleChange} /></div>
          </div>
          {/* Recipient Details */}
          <div className="form-column">
            <h4>Recipient Details</h4>
            <div className="form-group"><label>Name *</label><input type="text" name="name" value={formData.recipient_details.name} onChange={e => handleNestedChange('recipient_details', e)} required /></div>
            <div className="form-group"><label>Address 1</label><input type="text" name="address1" value={formData.recipient_details.address1} onChange={e => handleNestedChange('recipient_details', e)} /></div>
            <div className="form-group"><label>Postcode</label><input type="text" name="postCode" value={formData.recipient_details.postCode} onChange={e => handleNestedChange('recipient_details', e)} /></div>
            <div className="form-group"><label>Unloading Date</label><input type="date" name="unloading_date_time" value={formData.unloading_date_time} onChange={handleChange} /></div>
          </div>
        </div>

        {/* Cargo Details */}
        <h4>Cargo Details</h4>
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Quantity</th>
              <th>Weight (kg)</th>
              <th>Spaces</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(formData?.cargo_details?.pallets) ? formData.cargo_details.pallets : []).map((pallet, index) => (
              <tr key={index}>
                <td><select value={pallet.type} onChange={e => handlePalletChange(index, 'type', e.target.value)}><option value="micro">Micro</option><option value="quarter">Quarter</option><option value="half">Half</option><option value="half_plus">Half Plus</option><option value="full">Full</option></select></td>
                <td><input type="number" value={pallet.quantity} onChange={e => handlePalletChange(index, 'quantity', e.target.value)} min="1" /></td>
                <td><input type="number" value={pallet.weight} onChange={e => handlePalletChange(index, 'weight', e.target.value)} min="0" /></td>
                <td><input type="number" step="0.1" value={pallet.spaces} onChange={e => handlePalletChange(index, 'spaces', e.target.value)} min="0" /></td>
                <td><button type="button" onClick={() => removePalletRow(index)} className="btn-icon btn-danger"><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={addPalletRow} className="btn-secondary" style={{ marginTop: '1rem', alignSelf: 'flex-start' }}>Add Pallet</button>

        <div className="form-grid">
          <div className="form-group"><label>Total Weight (kg)</label><input type="number" name="total_kilos" value={formData.cargo_details.total_kilos} readOnly disabled /></div>
          <div className="form-group"><label>Total Spaces</label><input type="number" name="total_spaces" value={formData.cargo_details.total_spaces} readOnly disabled /></div>
        </div>

        {/* Surcharges */}
        <h4>Surcharges</h4>
        {formData.selected_surcharges?.includes('BW') ? (
          <div className="form-group">
            <label>4-Hour Window</label>
            <select onChange={handleTimeWindowChange} value={`${formData.unloading_start_time}-${formData.unloading_end_time}`}>
              <option value="">-- Select a time window --</option>
              {timeWindowOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        ) : formData.selected_surcharges?.some(code => surcharges.find(s => s.code === code)?.requires_time) && (
          <div className="form-grid">
            <div className="form-group">
              <label>Unloading Start Time</label><input type="time" name="unloading_start_time" value={formData.unloading_start_time || ''} onChange={handleChange} />
            </div>
            <div className="form-group"><label>Unloading End Time</label><input type="time" name="unloading_end_time" value={formData.unloading_end_time || ''} onChange={handleChange} /></div>
          </div>
        )}
        <div className="surcharge-options">
          {surcharges.map(s => (
            <div key={s.id} className="form-group-checkbox">
              <input type="checkbox" id={`surcharge-${s.code}`} value={s.code} checked={formData.selected_surcharges.includes(s.code)} onChange={handleSurchargeChange} />
              <label htmlFor={`surcharge-${s.code}`}>{s.name}</label>
            </div>
          ))}
        </div>

        {/* Pricing and Notes */}
        <div className="form-grid">
          <div className="form-group"><label>Notes</label><textarea name="notes" value={formData.notes || ''} onChange={handleChange} /></div>
          <div className="form-group">
            <label>Final Price (£)</label>
            <input type="number" step="0.01" name="final_price" value={formData.final_price} onChange={handleChange} placeholder={formData.calculated_price || 'Auto-calculated'} />
            {formData.calculated_price && <small>Calculated: £{formData.calculated_price}</small>}
          </div>
        </div>
        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Add Order')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddOrderForm;