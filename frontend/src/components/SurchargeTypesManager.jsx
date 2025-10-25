import React, { useState, useMemo } from 'react';
import { useApiResource } from '../hooks/useApiResource.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { Edit, Trash2, Plus, X } from 'lucide-react';
import { useForm } from '../hooks/useForm.js';

const initialFormData = {
  code: '',
  name: '',
  description: '',
  calculation_method: 'per_order',
  amount: 0,
  is_automatic: false,
  requires_time: false,
  start_time: '',
  end_time: '',
};

const SurchargeTypesManager = () => {
  const { data: surcharges, createResource, updateResource, deleteResource, fetchData } = useApiResource('/api/surcharge-types');
  const { showToast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const handleFormSubmit = async (formData) => {
    try {
      if (editingItem) {
        await updateResource(editingItem.id, formData);
        showToast('Surcharge type updated successfully!', 'success');
      } else {
        await createResource(formData);
        showToast('Surcharge type created successfully!', 'success');
      }
      setIsFormOpen(false);
      setEditingItem(null);
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to save surcharge type.', 'error');
      throw error; // Rzucamy błąd, aby useForm mógł go obsłużyć
    }
  };

  const { formData, handleChange, handleSubmit, loading } = useForm({
    initialState: initialFormData,
    onSubmit: handleFormSubmit,
    itemToEdit: useMemo(() => editingItem ? {
      ...editingItem,
      start_time: editingItem.start_time ? editingItem.start_time.substring(0, 5) : '',
      end_time: editingItem.end_time ? editingItem.end_time.substring(0, 5) : '',
    } : null, [editingItem]),
  });

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this surcharge type?')) {
      try {
        await deleteResource(id);
        showToast('Surcharge type deleted.', 'success');
        fetchData();
      } catch (error) {
        showToast(error.response?.data?.error || 'Failed to delete surcharge type.', 'error');
      }
    }
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingItem(null);
  };

  return (
    <div className="card">
      <h2>Surcharge Types Management</h2>
      {!isFormOpen && (
        <button onClick={handleAddNew} className="btn-primary" style={{ marginBottom: '1rem' }}>
          <Plus size={16} /> Add New Surcharge Type
        </button>
      )}

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="form" style={{ marginBottom: '2rem', border: '1px solid #eee', padding: '1rem', borderRadius: '8px' }}>
          <h5>{editingItem ? 'Edit Surcharge Type' : 'Add New Surcharge Type'}</h5>
          <div className="form-group"><label>Code *</label><input type="text" name="code" value={formData.code} onChange={handleChange} required /></div>
          <div className="form-group"><label>Name *</label><input type="text" name="name" value={formData.name} onChange={handleChange} required /></div>
          <div className="form-group"><label>Description</label><input type="text" name="description" value={formData.description} onChange={handleChange} /></div>
          <div className="form-group"><label>Calculation Method</label><select name="calculation_method" value={formData.calculation_method} onChange={handleChange}><option value="per_order">Per Order</option><option value="per_pallet_space">Per Pallet Space</option></select></div>
          <div className="form-group"><label>Amount (£)</label><input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} /></div>
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center' }}><input type="checkbox" id="is_automatic" name="is_automatic" checked={formData.is_automatic} onChange={handleChange} /><label htmlFor="is_automatic" style={{ marginBottom: 0, marginLeft: '0.5rem' }}>Automatic</label></div>
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center' }}><input type="checkbox" id="requires_time" name="requires_time" checked={formData.requires_time} onChange={handleChange} /><label htmlFor="requires_time" style={{ marginBottom: 0, marginLeft: '0.5rem' }}>Requires Time</label></div>
          {formData.requires_time && (
            <>
              <div className="form-group"><label>Default Start Time</label><input type="time" name="start_time" value={formData.start_time} onChange={handleChange} /></div>
              <div className="form-group"><label>Default End Time</label><input type="time" name="end_time" value={formData.end_time} onChange={handleChange} /></div>
            </>
          )}
          <div className="form-actions">
            <button type="button" onClick={handleCancel} className="btn-secondary" disabled={loading}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      )}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Automatic</th>
              <th>Requires Time</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {surcharges.map(item => (
              <tr key={item.id}>
                <td>{item.code}</td>
                <td>{item.name}</td>
                <td style={{ textTransform: 'capitalize' }}>{item.calculation_method.replace('_', ' ')}</td>
                <td>£{parseFloat(item.amount).toFixed(2)}</td>
                <td>{item.is_automatic ? 'Yes' : 'No'}</td>
                <td>{item.requires_time ? 'Yes' : 'No'}</td>
                <td>{item.start_time || '-'}</td>
                <td>{item.end_time || '-'}</td>
                <td className="actions-cell">
                  <button onClick={() => handleEdit(item)} className="btn-icon"><Edit size={16} /></button>
                  <button onClick={() => handleDelete(item.id)} className="btn-icon btn-danger"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SurchargeTypesManager;