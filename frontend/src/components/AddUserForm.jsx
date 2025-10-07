import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../services/api';

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
  const [error, setError] = useState(null);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Walidacja po stronie klienta dla trybu dodawania
    if (!isEditMode) {
      if (!formData.email || !formData.password || !formData.role || !formData.first_name || !formData.last_name) {
        setError('All fields are required.');
        setLoading(false);
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long.');
        setLoading(false);
        return;
      }
    }

    try {
      if (isEditMode) {
        // Na razie edytujemy tylko rolę, można rozszerzyć o edycję imienia i nazwiska
        await api.put(`/api/users/${itemToEdit.id}`, { 
          role: formData.role,
        });
      } else {
        await api.post('/api/users', formData);
      }
      onSuccess(); // Używamy spójnej nazwy funkcji zwrotnej
      onCancel(); // Zamknij formularz po sukcesie
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'An error occurred.';
      setError(errorMessage);
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

      {error && <div className="error-message">{error}</div>}

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
          />
        </div>

        <div className="form-group">
          <label>First Name *</label>
          <input
            type="text"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            required
            disabled={isEditMode} // Blokujemy edycję imienia
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
            disabled={isEditMode} // Blokujemy edycję nazwiska
          />
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
            />
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