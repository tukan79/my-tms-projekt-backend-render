import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api.js';
import { useToast } from '../../contexts/ToastContext.jsx';

const AddUserForm = ({ onSuccess, onCancel, itemToEdit }) => {
  const isEditMode = Boolean(itemToEdit);
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    role: 'dispatcher',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { showToast } = useToast();

  useEffect(() => {
    if (isEditMode && itemToEdit) {
      setFormData({
        email: itemToEdit.email,
        first_name: itemToEdit.first_name || '',
        last_name: itemToEdit.last_name || '',
        password: '',
        role: itemToEdit.role,
      });
    } else {
      setFormData({ email: '', password: '', role: 'dispatcher', first_name: '', last_name: '' });
    }
  }, [itemToEdit, isEditMode]);

  const validateForm = useCallback((data, isEdit) => {
    const newErrors = {};
    if (!data.email) newErrors.email = 'Email is required.';
    if (!data.first_name) newErrors.first_name = 'First name is required.';
    if (!data.last_name) newErrors.last_name = 'Last name is required.';
    if (!isEdit && (!data.password || data.password.length < 6)) {
      newErrors.password = 'Password must be at least 6 characters long.';
    }
    return newErrors;
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }, [formData, errors]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm(formData, isEditMode);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setLoading(true);

    try {
      if (isEditMode) {
        await api.put(`/api/users/${itemToEdit.id}`, { 
          role: formData.role,
          first_name: formData.first_name,
          last_name: formData.last_name,
        });
        showToast('User updated successfully!', 'success');
      } else {
        await api.post('/api/users', formData);
        showToast('User created successfully!', 'success');
      }
      onSuccess(); // Używamy spójnej nazwy funkcji zwrotnej
      onCancel(); // Zamknij formularz po sukcesie
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'An error occurred.';
      setErrors({ form: errorMessage });
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>{isEditMode ? 'Edit User' : 'Add New User'}</h2>
        <button onClick={onCancel} className="btn-icon">
          <X size={20} />
        </button>
      </div>

      {errors.form && <div className="error-message">{errors.form}</div>}

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>Email *</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={isEditMode}
            className={errors.email ? 'input-error' : ''}
          />
          {errors.email && <span className="error-text">{errors.email}</span>}
        </div>

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

        {!isEditMode && (
          <div className="form-group">
            <label>Password *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className={errors.password ? 'input-error' : ''}
            />
            {errors.password && <span className="error-text">{errors.password}</span>}
          </div>
        )}

        <div className="form-group">
          <label>Role *</label>
          <select name="role" value={formData.role} onChange={handleChange} required>
            <option value="dispatcher">Dispatcher</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading 
              ? (isEditMode ? 'Saving...' : 'Adding...') 
              : (isEditMode ? 'Save Changes' : 'Add User')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddUserForm;